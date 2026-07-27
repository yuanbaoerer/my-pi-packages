import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execSync } from "node:child_process";

/**
 * GitHub MCP-like extension for pi.
 * Provides tools for Issues, Pull Requests, Repositories, Files, Search, and more.
 * Requires `gh` CLI to be installed and authenticated.
 */

// ── Helpers ──────────────────────────────────────────────────────────────

function gh(args: string, opts?: { cwd?: string; timeout?: number }): string {
  try {
    return execSync(`gh ${args}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
      timeout: opts?.timeout ?? 30_000,
      cwd: opts?.cwd,
    });
  } catch (e: any) {
    const stderr = e.stderr || e.message || "";
    throw new Error(`gh ${args.split(" ")[0]} failed: ${stderr.trim()}`);
  }
}

function ghJson(args: string, opts?: { cwd?: string; timeout?: number }): any {
  const out = gh(`${args} --json`, opts);
  try {
    return JSON.parse(out);
  } catch {
    return out;
  }
}

function ghJsonWithFields(args: string, fields: string[], opts?: { cwd?: string; timeout?: number }): any {
  const out = gh(`${args} --json ${fields.join(",")}`, opts);
  try {
    return JSON.parse(out);
  } catch {
    return out;
  }
}

function ghMaybe(args: string, opts?: { cwd?: string; timeout?: number }): string | null {
  try {
    return gh(args, opts);
  } catch {
    return null;
  }
}

function repoFlag(cwd?: string): string {
  try {
    const repo = execSync("git remote get-url origin", {
      encoding: "utf-8",
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    // convert git@github.com:owner/repo.git -> owner/repo or https://github.com/owner/repo
    const match = repo.match(/[:/]([^/]+?\/[^/]+?)(?:\.git)?$/);
    return match ? `-R ${match[1]}` : "";
  } catch {
    return "";
  }
}

function success(text: string) {
  return { content: [{ type: "text", text }], details: {} };
}

function jsonSuccess(data: any) {
  return success("```json\n" + JSON.stringify(data, null, 2) + "\n```");
}

// ── Extension ────────────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  // ========== Issues ==========

  pi.registerTool({
    name: "github_list_issues",
    label: "List Issues",
    description:
      "List GitHub issues in a repository. Can filter by state, labels, assignee, etc.",
    promptSnippet: "List GitHub issues (filterable by state, labels, assignee)",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Repository as owner/repo. Defaults to current repo." })),
      state: Type.Optional(Type.String({ description: "Filter: open, closed, all. Default: open." })),
      labels: Type.Optional(Type.String({ description: "Comma-separated label names" })),
      assignee: Type.Optional(Type.String({ description: "Filter by assignee" })),
      limit: Type.Optional(Type.Number({ description: "Max results. Default 30." })),
      search: Type.Optional(Type.String({ description: "Search query in title/body" })),
    }),
    async execute(_toolCallId, params, _signal) {
      const repo = params.repo || repoFlag().replace("-R ", "");
      if (!repo) throw new Error("No repo specified and not in a git repo");
      const flags = [`-R ${repo}`];
      let st = params.state ?? "open";
      if (st) flags.push(`-s ${st}`);
      if (params.labels) flags.push(`-l "${params.labels}"`);
      if (params.assignee) flags.push(`-a "${params.assignee}"`);
      if (params.limit) flags.push(`-L ${params.limit}`);
      if (params.search) flags.push(`-S "${params.search}"`);
      const data = ghJsonWithFields(
        `issue list ${flags.join(" ")}`,
        ["number", "title", "state", "labels", "assignees", "createdAt", "updatedAt", "url"],
      );
      return jsonSuccess(data);
    },
  });

  pi.registerTool({
    name: "github_get_issue",
    label: "Get Issue",
    description: "Get details of a single GitHub issue by number.",
    promptSnippet: "Get a specific GitHub issue's details and comments",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Repository as owner/repo." })),
      number: Type.Number({ description: "Issue number" }),
      includeComments: Type.Optional(Type.Boolean({ description: "Also fetch the first 30 comments. Default true." })),
    }),
    async execute(_toolCallId, params, _signal) {
      const repo = params.repo || repoFlag().replace("-R ", "");
      if (!repo) throw new Error("No repo specified and not in a git repo");
      const data = ghJsonWithFields(
        `issue view ${params.number} -R ${repo}`,
        ["number", "title", "state", "body", "labels", "assignees", "createdAt", "updatedAt", "url", "author", "comments"],
      );
      if (params.includeComments !== false) {
        try {
          const comments = ghJsonWithFields(
            `issue view ${params.number} -R ${repo} --comments`,
            ["id", "body", "author", "createdAt"],
          );
          if (comments && Array.isArray(comments)) {
            (data as any).comments = comments;
          }
        } catch { /* ignore */ }
      }
      return jsonSuccess(data);
    },
  });

  pi.registerTool({
    name: "github_create_issue",
    label: "Create Issue",
    description: "Create a new GitHub issue.",
    promptSnippet: "Create a GitHub issue with title, body, labels, and assignees",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Repository as owner/repo." })),
      title: Type.String({ description: "Issue title" }),
      body: Type.Optional(Type.String({ description: "Issue body (Markdown)" })),
      labels: Type.Optional(Type.String({ description: "Comma-separated label names" })),
      assignees: Type.Optional(Type.String({ description: "Comma-separated usernames" })),
    }),
    async execute(_toolCallId, params, _signal) {
      const repo = params.repo || repoFlag().replace("-R ", "");
      if (!repo) throw new Error("No repo specified and not in a git repo");
      const args = [`issue create -R ${repo} -t "${params.title.replace(/"/g, '\\"')}"`];
      if (params.body) args.push(`-b "${params.body.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`);
      if (params.labels) args.push(`-l "${params.labels}"`);
      if (params.assignees) args.push(`-a "${params.assignees}"`);
      const out = gh(args.join(" "));
      return success(`Issue created:\n${out.trim()}`);
    },
  });

  pi.registerTool({
    name: "github_update_issue",
    label: "Update Issue",
    description: "Update an existing GitHub issue (title, body, state, labels, etc.).",
    promptSnippet: "Update a GitHub issue (title, body, state, labels, assignees)",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Repository as owner/repo." })),
      number: Type.Number({ description: "Issue number" }),
      title: Type.Optional(Type.String({})),
      body: Type.Optional(Type.String({})),
      state: Type.Optional(Type.String({ description: "open or closed" })),
      labels: Type.Optional(Type.String({ description: "Comma-separated labels" })),
      assignees: Type.Optional(Type.String({ description: "Comma-separated usernames" })),
      addComment: Type.Optional(Type.String({ description: "Text to add as a comment on the issue" })),
    }),
    async execute(_toolCallId, params, _signal) {
      const repo = params.repo || repoFlag().replace("-R ", "");
      if (!repo) throw new Error("No repo specified and not in a git repo");
      const results: string[] = [];
      const base = `issue edit ${params.number} -R ${repo}`;
      const args: string[] = [];
      if (params.title) args.push(`-t "${params.title.replace(/"/g, '\\"')}"`);
      if (params.body) args.push(`-b "${params.body.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`);
      if (params.state) {
        if (params.state === "closed") args.push("--close");
        else if (params.state === "open") args.push("--reopen");
      }
      if (params.labels) args.push(`--add-label "${params.labels}"`);
      if (params.assignees) args.push(`--add-assignee "${params.assignees}"`);
      if (args.length > 0) {
        gh(`${base} ${args.join(" ")}`);
        results.push("Issue updated.");
      }
      if (params.addComment) {
        gh(`issue comment ${params.number} -R ${repo} -b "${params.addComment.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`);
        results.push("Comment added.");
      }
      return success(results.join("\n") || "No changes requested.");
    },
  });

  pi.registerTool({
    name: "github_comment_issue",
    label: "Comment on Issue",
    description: "Add a comment to a GitHub issue or pull request.",
    promptSnippet: "Add a comment to a GitHub issue or pull request",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Repository as owner/repo." })),
      number: Type.Number({ description: "Issue or PR number" }),
      body: Type.String({ description: "Comment body (Markdown)" }),
    }),
    async execute(_toolCallId, params, _signal) {
      const repo = params.repo || repoFlag().replace("-R ", "");
      if (!repo) throw new Error("No repo specified and not in a git repo");
      gh(`issue comment ${params.number} -R ${repo} -b "${params.body.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`);
      return success("Comment added.");
    },
  });

  // ========== Pull Requests ==========

  pi.registerTool({
    name: "github_list_pull_requests",
    label: "List PRs",
    description: "List pull requests in a repository.",
    promptSnippet: "List GitHub pull requests (filterable by state, labels, author)",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Repository as owner/repo." })),
      state: Type.Optional(Type.String({ description: "open, closed, merged, all. Default: open." })),
      labels: Type.Optional(Type.String({ description: "Comma-separated labels" })),
      author: Type.Optional(Type.String({ description: "Filter by PR author" })),
      base: Type.Optional(Type.String({ description: "Filter by base branch" })),
      limit: Type.Optional(Type.Number({ description: "Max results. Default 30." })),
      search: Type.Optional(Type.String({ description: "Search in title/body" })),
    }),
    async execute(_toolCallId, params, _signal) {
      const repo = params.repo || repoFlag().replace("-R ", "");
      if (!repo) throw new Error("No repo specified and not in a git repo");
      const flags = [`-R ${repo}`];
      let st = params.state ?? "open";
      if (st) flags.push(`-s ${st}`);
      if (params.labels) flags.push(`-l "${params.labels}"`);
      if (params.author) flags.push(`-A "${params.author}"`);
      if (params.base) flags.push(`-B "${params.base}"`);
      if (params.limit) flags.push(`-L ${params.limit}`);
      if (params.search) flags.push(`-S "${params.search}"`);
      const data = ghJsonWithFields(
        `pr list ${flags.join(" ")}`,
        ["number", "title", "state", "labels", "author", "createdAt", "updatedAt", "url", "headRefName", "baseRefName", "isDraft", "mergeable"],
      );
      return jsonSuccess(data);
    },
  });

  pi.registerTool({
    name: "github_get_pull_request",
    label: "Get PR",
    description: "Get details of a single pull request including diff, files, and reviews.",
    promptSnippet: "Get PR details: diff, changed files, reviews, and comments",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Repository as owner/repo." })),
      number: Type.Number({ description: "PR number" }),
      includeDiff: Type.Optional(Type.Boolean({ description: "Include the full diff. Default true." })),
      includeReviews: Type.Optional(Type.Boolean({ description: "Include reviews. Default true." })),
      includeComments: Type.Optional(Type.Boolean({ description: "Include comments. Default false." })),
    }),
    async execute(_toolCallId, params, _signal) {
      const repo = params.repo || repoFlag().replace("-R ", "");
      if (!repo) throw new Error("No repo specified and not in a git repo");
      const data = ghJsonWithFields(
        `pr view ${params.number} -R ${repo}`,
        ["number", "title", "state", "body", "author", "createdAt", "updatedAt", "url", "headRefName", "baseRefName", "isDraft", "mergeable", "mergedAt", "additions", "deletions", "changedFiles", "labels", "assignees", "reviewRequests", "milestone"],
      );

      const extra: any = {};

      // Diff
      if (params.includeDiff !== false) {
        try {
          extra.diff = gh(`pr diff ${params.number} -R ${repo} --color=never`);
        } catch { /* no diff */ }
      }

      // Reviews
      if (params.includeReviews !== false) {
        try {
          extra.reviews = ghJsonWithFields(
            `pr view ${params.number} -R ${repo} --json reviews`,
            [],
          );
          if (extra.reviews && Array.isArray((extra.reviews as any).reviews)) {
            extra.reviews = (extra.reviews as any).reviews;
          }
        } catch { /* no reviews */ }
      }

      // Comments
      if (params.includeComments) {
        try {
          extra.comments = ghJsonWithFields(
            `pr view ${params.number} -R ${repo} --comments`,
            ["id", "body", "author", "createdAt"],
          );
        } catch { /* no comments */ }
      }

      // Files list
      try {
        extra.files = gh(`pr view ${params.number} -R ${repo} --json files --jq '.files.[].path'`)
          .trim().split("\n").filter(Boolean);
      } catch { /* no files */ }

      Object.assign(data as any, extra);
      // Truncate diff if too large
      if ((data as any).diff && (data as any).diff.length > 20_000) {
        (data as any).diff = (data as any).diff.slice(0, 20_000) + "\n... (diff truncated)";
      }
      return jsonSuccess(data);
    },
  });

  pi.registerTool({
    name: "github_create_pull_request",
    label: "Create PR",
    description: "Create a new pull request from a branch.",
    promptSnippet: "Create a GitHub pull request from a head branch to a base branch",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Repository as owner/repo." })),
      title: Type.String({ description: "PR title" }),
      body: Type.Optional(Type.String({ description: "PR body (Markdown)" })),
      head: Type.Optional(Type.String({ description: "Head branch name. Default: current branch." })),
      base: Type.Optional(Type.String({ description: "Base branch. Default: repo default (main/master)." })),
      draft: Type.Optional(Type.Boolean({ description: "Create as draft. Default false." })),
    }),
    async execute(_toolCallId, params, _signal) {
      const repo = params.repo || repoFlag().replace("-R ", "");
      if (!repo) throw new Error("No repo specified and not in a git repo");
      const args = [`pr create -R ${repo} -t "${params.title.replace(/"/g, '\\"')}"`];
      if (params.body) args.push(`-b "${params.body.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`);
      if (params.head) args.push(`--head "${params.head}"`);
      if (params.base) args.push(`--base "${params.base}"`);
      if (params.draft) args.push("--draft");
      const out = gh(args.join(" "));
      return success(`Pull request created:\n${out.trim()}`);
    },
  });

  pi.registerTool({
    name: "github_merge_pull_request",
    label: "Merge PR",
    description: "Merge a pull request.",
    promptSnippet: "Merge a GitHub pull request (merge, squash, or rebase)",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Repository as owner/repo." })),
      number: Type.Number({ description: "PR number" }),
      strategy: Type.Optional(Type.String({ description: "merge, squash, or rebase. Default: merge." })),
      body: Type.Optional(Type.String({ description: "Merge commit message body" })),
      deleteBranch: Type.Optional(Type.Boolean({ description: "Delete head branch after merge. Default false." })),
    }),
    async execute(_toolCallId, params, _signal) {
      const repo = params.repo || repoFlag().replace("-R ", "");
      if (!repo) throw new Error("No repo specified and not in a git repo");
      const args = [`pr merge ${params.number} -R ${repo}`];
      const strategy = params.strategy ?? "merge";
      if (strategy === "squash") args.push("--squash");
      else if (strategy === "rebase") args.push("--rebase");
      else args.push("--merge");
      if (params.body) args.push(`-b "${params.body.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`);
      if (params.deleteBranch) args.push("--delete-branch");
      const out = gh(args.join(" "));
      return success(out.trim());
    },
  });

  pi.registerTool({
    name: "github_review_pull_request",
    label: "Review PR",
    description: "Submit a review on a pull request (approve, comment, or request changes).",
    promptSnippet: "Review a PR: approve, comment, or request changes",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Repository as owner/repo." })),
      number: Type.Number({ description: "PR number" }),
      body: Type.String({ description: "Review comment body" }),
      action: Type.String({ description: "approve, comment, or request_changes. Default: comment." }),
    }),
    async execute(_toolCallId, params, _signal) {
      const repo = params.repo || repoFlag().replace("-R ", "");
      if (!repo) throw new Error("No repo specified and not in a git repo");
      const action = params.action ?? "comment";
      const flag = action === "approve" ? "--approve" : action === "request_changes" ? "--request-changes" : "--comment";
      gh(`pr review ${params.number} -R ${repo} ${flag} -b "${params.body.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`);
      return success(`Review submitted (${action}).`);
    },
  });

  // ========== Repositories ==========

  pi.registerTool({
    name: "github_search_repositories",
    label: "Search Repos",
    description: "Search GitHub repositories by query.",
    promptSnippet: "Search for GitHub repositories matching a query",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      language: Type.Optional(Type.String({ description: "Filter by language" })),
      sort: Type.Optional(Type.String({ description: "stars, forks, updated. Default: best match." })),
      limit: Type.Optional(Type.Number({ description: "Max results. Default 10." })),
    }),
    async execute(_toolCallId, params, _signal) {
      const args = [`search repos "${params.query}"`];
      if (params.language) args.push(`--language=${params.language}`);
      let sort = params.sort ?? "best-match";
      if (sort !== "best-match") args.push(`--sort=${sort}`);
      args.push(`-L ${params.limit ?? 10}`);
      const data = ghJsonWithFields(
        args.join(" "),
        ["fullName", "description", "url", "stargazersCount", "forksCount", "language", "updatedAt"],
      );
      return jsonSuccess(data);
    },
  });

  pi.registerTool({
    name: "github_get_repository",
    label: "Get Repo",
    description: "Get details of a GitHub repository.",
    promptSnippet: "Get a GitHub repository's details and metadata",
    parameters: Type.Object({
      repo: Type.String({ description: "Repository as owner/repo" }),
    }),
    async execute(_toolCallId, params, _signal) {
      const data = ghJsonWithFields(
        `repo view ${params.repo}`,
        ["nameWithOwner", "description", "url", "sshUrl", "stargazersCount", "forksCount", "openIssuesCount", "watchers", "primaryLanguage", "defaultBranchRef", "createdAt", "updatedAt", "licenseInfo", "isPrivate", "isFork", "homepageUrl", "diskUsage"],
      );
      return jsonSuccess(data);
    },
  });

  pi.registerTool({
    name: "github_create_repository",
    label: "Create Repo",
    description: "Create a new GitHub repository.",
    promptSnippet: "Create a new GitHub repository",
    parameters: Type.Object({
      name: Type.String({ description: "Repository name" }),
      description: Type.Optional(Type.String({})),
      private: Type.Optional(Type.Boolean({ description: "Make private. Default false (public)." })),
      clone: Type.Optional(Type.Boolean({ description: "Clone after creation. Default false." })),
    }),
    async execute(_toolCallId, params, _signal) {
      const args = [`repo create "${params.name}"`];
      if (params.description) args.push(`-d "${params.description.replace(/"/g, '\\"')}"`);
      if (params.private) args.push("--private"); else args.push("--public");
      if (params.clone) args.push("--clone");
      const out = gh(args.join(" "));
      return success(out.trim());
    },
  });

  pi.registerTool({
    name: "github_fork_repository",
    label: "Fork Repo",
    description: "Fork a GitHub repository to your account.",
    promptSnippet: "Fork a GitHub repository",
    parameters: Type.Object({
      repo: Type.String({ description: "Repository to fork, as owner/repo" }),
      clone: Type.Optional(Type.Boolean({ description: "Clone the fork locally. Default false." })),
    }),
    async execute(_toolCallId, params, _signal) {
      const args = [`repo fork ${params.repo}`];
      if (params.clone) args.push("--clone");
      else args.push("--remote=false");
      const out = gh(args.join(" "));
      return success(out.trim());
    },
  });

  // ========== Files & Content ==========

  pi.registerTool({
    name: "github_get_file_contents",
    label: "Get File",
    description: "Get the contents of a file from a GitHub repository.",
    promptSnippet: "Read a file's contents from a GitHub repository via the API",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Repository as owner/repo." })),
      path: Type.String({ description: "File path in the repository" }),
      ref: Type.Optional(Type.String({ description: "Branch, tag, or commit SHA. Default: default branch." })),
    }),
    async execute(_toolCallId, params, _signal) {
      const repo = params.repo || repoFlag().replace("-R ", "");
      if (!repo) throw new Error("No repo specified and not in a git repo");
      // Use gh api to get raw content
      let apiPath = `/repos/${repo}/contents/${params.path}`;
      if (params.ref) apiPath += `?ref=${params.ref}`;
      try {
        const content = gh(`api ${apiPath} --jq ".content"`);
        const decoded = Buffer.from(content.trim().replace(/\s/g, ""), "base64").toString("utf-8");
        const truncated = decoded.length > 30_000 ? decoded.slice(0, 30_000) + "\n... (truncated)" : decoded;
        return success(truncated);
      } catch {
        // fallback: try viewing as a repo file
        try {
          const out = gh(`repo view ${repo} --json=defaultBranchRef`);
          const branch = JSON.parse(out).defaultBranchRef?.name ?? "main";
          const rawUrl = `https://raw.githubusercontent.com/${repo}/${params.ref ?? branch}/${params.path}`;
          const content = execSync(`curl -sL "${rawUrl}"`, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
          const truncated = content.length > 30_000 ? content.slice(0, 30_000) + "\n... (truncated)" : content;
          return success(truncated);
        } catch (e: any) {
          throw new Error(`Failed to get file: ${e.message}`);
        }
      }
    },
  });

  pi.registerTool({
    name: "github_create_or_update_file",
    label: "Create/Update File",
    description: "Create or update a single file in a GitHub repository (creates a commit).",
    promptSnippet: "Create or update a file on GitHub via API (creates a commit)",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Repository as owner/repo." })),
      path: Type.String({ description: "File path in the repository" }),
      content: Type.String({ description: "File content" }),
      message: Type.String({ description: "Commit message" }),
      branch: Type.Optional(Type.String({ description: "Branch name. Default: repo default branch." })),
    }),
    async execute(_toolCallId, params, _signal) {
      const repo = params.repo || repoFlag().replace("-R ", "");
      if (!repo) throw new Error("No repo specified and not in a git repo");
      // We use gh api PUT with base64 content
      const base64Content = Buffer.from(params.content).toString("base64");
      let apiPath = `/repos/${repo}/contents/${params.path}`;
      const payload: any = {
        message: params.message,
        content: base64Content,
      };
      if (params.branch) payload.branch = params.branch;
      // Read existing file to get SHA if updating
      try {
        const existing = JSON.parse(gh(`api ${apiPath}${params.branch ? `?ref=${params.branch}` : ""}`));
        if (existing.sha) payload.sha = existing.sha;
      } catch { /* new file */ }
      const result = gh(`api -X PUT ${apiPath} -f '${JSON.stringify(payload).replace(/'/g, "'\\''")}'`);
      const parsed = JSON.parse(result);
      return success(`File ${params.path} ${payload.sha ? "updated" : "created"}.\nCommit: ${parsed.commit?.message ?? params.message}\nURL: ${parsed.content?.html_url ?? ""}`);
    },
  });

  // ========== Branches ==========

  pi.registerTool({
    name: "github_list_branches",
    label: "List Branches",
    description: "List branches in a GitHub repository.",
    promptSnippet: "List branches in a GitHub repository",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Repository as owner/repo." })),
      limit: Type.Optional(Type.Number({ description: "Max results. Default 30." })),
    }),
    async execute(_toolCallId, params, _signal) {
      const repo = params.repo || repoFlag().replace("-R ", "");
      if (!repo) throw new Error("No repo specified and not in a git repo");
      const data = ghJson(`api /repos/${repo}/branches?per_page=${params.limit ?? 30}`);
      // compact
      const branches = (Array.isArray(data) ? data : []).map((b: any) => ({
        name: b.name,
        sha: b.commit?.sha?.slice(0, 7),
      }));
      return jsonSuccess(branches);
    },
  });

  // ========== Commits ==========

  pi.registerTool({
    name: "github_list_commits",
    label: "List Commits",
    description: "List commits in a branch or PR.",
    promptSnippet: "List commits for a branch or pull request",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Repository as owner/repo." })),
      branch: Type.Optional(Type.String({ description: "Branch name. Default: default branch." })),
      prNumber: Type.Optional(Type.Number({ description: "PR number (takes priority over branch)" })),
      author: Type.Optional(Type.String({ description: "Filter by author username" })),
      since: Type.Optional(Type.String({ description: "ISO 8601 date, e.g. 2025-01-01T00:00:00Z" })),
      limit: Type.Optional(Type.Number({ description: "Max results. Default 20." })),
    }),
    async execute(_toolCallId, params, _signal) {
      const repo = params.repo || repoFlag().replace("-R ", "");
      if (!repo) throw new Error("No repo specified and not in a git repo");
      let apiPath: string;
      if (params.prNumber) {
        apiPath = `/repos/${repo}/pulls/${params.prNumber}/commits`;
      } else {
        apiPath = `/repos/${repo}/commits`;
      }
      const query: string[] = [`per_page=${params.limit ?? 20}`];
      if (params.branch && !params.prNumber) query.push(`sha=${params.branch}`);
      if (params.author) query.push(`author=${params.author}`);
      if (params.since) query.push(`since=${params.since}`);
      try {
        const data = JSON.parse(gh(`api ${apiPath}${query.length ? "?" + query.join("&") : ""}`));
        const commits = (Array.isArray(data) ? data : []).map((c: any) => ({
          sha: c.sha?.slice(0, 7) ?? c.sha,
          message: c.commit?.message?.split("\n")[0],
          author: c.commit?.author?.name ?? c.author?.login,
          date: c.commit?.author?.date ?? c.commit?.committer?.date,
          url: c.html_url,
        }));
        return jsonSuccess(commits);
      } catch {
        // fallback to non-json
        const out = gh(`api ${apiPath} --jq '.[] | {sha: .sha[0:7], msg: .commit.message | split("\\n")[0], author: .commit.author.name, date: .commit.author.date}'`);
        return success(out.trim());
      }
    },
  });

  // ========== Search ==========

  pi.registerTool({
    name: "github_search_code",
    label: "Search Code",
    description: "Search code across GitHub repositories.",
    promptSnippet: "Search code on GitHub with qualifiers like language, repo, path",
    parameters: Type.Object({
      query: Type.String({ description: "Search query. Use qualifiers like language:..., repo:..., path:..." }),
      limit: Type.Optional(Type.Number({ description: "Max results. Default 10." })),
    }),
    async execute(_toolCallId, params, _signal) {
      const args = [`search code "${params.query}" --limit=${params.limit ?? 10}`];
      const data = ghJsonWithFields(
        args.join(" "),
        ["repository", "path", "url"],
      );
      return jsonSuccess(data);
    },
  });

  pi.registerTool({
    name: "github_search_issues",
    label: "Search Issues",
    description: "Search issues and PRs across GitHub.",
    promptSnippet: "Search GitHub issues and PRs by query",
    parameters: Type.Object({
      query: Type.String({ description: "Search query (supports type:issue, type:pr, label:, state:, etc.)" }),
      limit: Type.Optional(Type.Number({ description: "Max results. Default 10." })),
    }),
    async execute(_toolCallId, params, _signal) {
      const args = [`search issues "${params.query}" --limit=${params.limit ?? 10}`];
      const data = ghJsonWithFields(
        args.join(" "),
        ["repository", "title", "state", "number", "url", "type", "labels", "createdAt"],
      );
      return jsonSuccess(data);
    },
  });

  // ========== Actions / Workflows ==========

  pi.registerTool({
    name: "github_list_workflows",
    label: "List Workflows",
    description: "List GitHub Actions workflows in a repository.",
    promptSnippet: "List GitHub Actions workflows and their last run status",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Repository as owner/repo." })),
    }),
    async execute(_toolCallId, params, _signal) {
      const repo = params.repo || repoFlag().replace("-R ", "");
      if (!repo) throw new Error("No repo specified and not in a git repo");
      const data = ghJson(`run list -R ${repo} --limit=20`);
      return jsonSuccess(data);
    },
  });

  pi.registerTool({
    name: "github_get_workflow_status",
    label: "Get Workflow Status",
    description: "Get the status of a specific workflow run.",
    promptSnippet: "Check the status of a GitHub Actions workflow run",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Repository as owner/repo." })),
      runId: Type.String({ description: "Workflow run ID" }),
    }),
    async execute(_toolCallId, params, _signal) {
      const repo = params.repo || repoFlag().replace("-R ", "");
      if (!repo) throw new Error("No repo specified and not in a git repo");
      const data = ghJson(`run view ${params.runId} -R ${repo}`);
      return jsonSuccess(data);
    },
  });

  // ========== Releases ==========

  pi.registerTool({
    name: "github_list_releases",
    label: "List Releases",
    description: "List releases for a GitHub repository.",
    promptSnippet: "List GitHub releases for a repository",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Repository as owner/repo." })),
      limit: Type.Optional(Type.Number({ description: "Max results. Default 10." })),
    }),
    async execute(_toolCallId, params, _signal) {
      const repo = params.repo || repoFlag().replace("-R ", "");
      if (!repo) throw new Error("No repo specified and not in a git repo");
      const data = ghJsonWithFields(
        `release list -R ${repo} -L ${params.limit ?? 10}`,
        ["tagName", "name", "publishedAt", "url", "isDraft", "isPrerelease"],
      );
      return jsonSuccess(data);
    },
  });

  // ========== Gist support ==========

  pi.registerTool({
    name: "github_list_gists",
    label: "List Gists",
    description: "List your GitHub gists.",
    promptSnippet: "List your GitHub gists",
    parameters: Type.Object({
      limit: Type.Optional(Type.Number({ description: "Max results. Default 10." })),
      public: Type.Optional(Type.Boolean({ description: "List public gists. Default false." })),
    }),
    async execute(_toolCallId, params, _signal) {
      const args = [`gist list -L ${params.limit ?? 10}`];
      if (params.public) args.push("--public");
      const data = ghJsonWithFields(
        args.join(" "),
        ["id", "description", "updatedAt", "url", "files"],
      );
      return jsonSuccess(data);
    },
  });

  pi.registerTool({
    name: "github_create_gist",
    label: "Create Gist",
    description: "Create a new GitHub gist.",
    promptSnippet: "Create a GitHub gist with a description and file contents",
    parameters: Type.Object({
      description: Type.Optional(Type.String({})),
      filename: Type.String({ description: "Filename for the gist" }),
      content: Type.String({ description: "File content" }),
      public: Type.Optional(Type.Boolean({ description: "Make public. Default false (secret)." })),
    }),
    async execute(_toolCallId, params, _signal) {
      // gh gist create doesn't accept inline content easily, so use a temp file
      const fs = await import("node:fs");
      const os = await import("node:os");
      const path = await import("node:path");
      const tmpDir = os.tmpdir();
      const tmpFile = path.join(tmpDir, params.filename);
      fs.writeFileSync(tmpFile, params.content);
      const args = [`gist create "${tmpFile}"`];
      if (params.description) args.push(`-d "${params.description.replace(/"/g, '\\"')}"`);
      if (params.public) args.push("--public");
      const out = gh(args.join(" "));
      fs.unlinkSync(tmpFile);
      return success(`Gist created:\n${out.trim()}`);
    },
  });

  // ========== Misc ==========

  pi.registerTool({
    name: "github_get_me",
    label: "Get My User",
    description: "Get your current GitHub user info and rate limit status.",
    promptSnippet: "Show authenticated GitHub user and API rate limit info",
    parameters: Type.Object({}),
    async execute() {
      const user = ghJson(`api user`);
      const rateLimit = ghJson(`api rate_limit`);
      return jsonSuccess({ user, rate_limit: rateLimit });
    },
  });

  pi.registerTool({
    name: "github_get_user",
    label: "Get User",
    description: "Get the profile info of a GitHub user.",
    promptSnippet: "Get a GitHub user's profile information",
    parameters: Type.Object({
      username: Type.String({ description: "GitHub username" }),
    }),
    async execute(_toolCallId, params, _signal) {
      const data = ghJson(`api users/${params.username}`);
      const compact = {
        login: data.login,
        name: data.name,
        bio: data.bio,
        company: data.company,
        blog: data.blog,
        location: data.location,
        public_repos: data.public_repos,
        followers: data.followers,
        following: data.following,
        created_at: data.created_at,
        html_url: data.html_url,
      };
      return jsonSuccess(compact);
    },
  });

  pi.registerTool({
    name: "github_compare",
    label: "Compare",
    description: "Compare two commits, branches, or tags and show the diff.",
    promptSnippet: "Compare two refs (branches/commits/tags) on GitHub and show the diff",
    parameters: Type.Object({
      repo: Type.Optional(Type.String({ description: "Repository as owner/repo." })),
      base: Type.String({ description: "Base ref (branch, tag, commit SHA)" }),
      head: Type.String({ description: "Head ref (branch, tag, commit SHA)" }),
    }),
    async execute(_toolCallId, params, _signal) {
      const repo = params.repo || repoFlag().replace("-R ", "");
      if (!repo) throw new Error("No repo specified and not in a git repo");
      const data = ghJson(`api /repos/${repo}/compare/${params.base}...${params.head}`);
      const summary = {
        status: data.status,
        ahead_by: data.ahead_by,
        behind_by: data.behind_by,
        total_commits: data.total_commits,
        files_changed: data.files?.length ?? 0,
        commits: (data.commits ?? []).map((c: any) => ({
          sha: c.sha?.slice(0, 7),
          message: c.commit?.message?.split("\n")[0],
        })),
        files: (data.files ?? []).map((f: any) => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
        })),
      };
      return jsonSuccess(summary);
    },
  });

  pi.registerTool({
    name: "github_raw_api",
    label: "GitHub API Call",
    description:
      "Make an arbitrary authenticated request to the GitHub REST API. Use for endpoints not covered by other tools.",
    promptSnippet: "Call an arbitrary GitHub REST API endpoint (authenticated)",
    parameters: Type.Object({
      method: Type.Optional(Type.String({ description: "HTTP method: GET, POST, PUT, PATCH, DELETE. Default: GET." })),
      endpoint: Type.String({ description: "API path, e.g. /repos/owner/repo/issues" }),
      body: Type.Optional(Type.String({ description: "JSON request body for POST/PUT/PATCH" })),
    }),
    async execute(_toolCallId, params, _signal) {
      const method = params.method ?? "GET";
      const args = [`api ${params.endpoint} -X ${method}`];
      if (params.body) args.push(`-f '${params.body}'`);
      const out = gh(args.join(" "));
      try {
        const parsed = JSON.parse(out);
        return jsonSuccess(parsed);
      } catch {
        return success(out);
      }
    },
  });

  // Notify on load
  pi.on("session_start", async (_event, ctx) => {
    const repo = repoFlag().replace("-R ", "");
    ctx.ui.notify(
      `🐙 GitHub extension loaded${repo ? ` (repo: ${repo})` : ""}`,
      "info",
    );
  });
}
