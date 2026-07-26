---
name: github
description: Manage GitHub repositories, issues, pull requests, code review, gists, and Actions workflows via the gh CLI. Use when the user talks about GitHub repos, PRs, issues, releases, or any GitHub operations.
---

# GitHub

Full GitHub management via the `gh` CLI. Already authenticated.

## Quick Reference

### Issues
```bash
gh issue list --limit 10                        # List issues in current repo
gh issue list --repo owner/repo --limit 10      # List issues in specific repo
gh issue view <number>                          # View issue details
gh issue view <number> --repo owner/repo --json number,title,body,state,labels,assignees,comments
gh issue create --title "..." --body "..."      # Create issue
gh issue create --repo owner/repo --title "..." --body "..."
gh issue close <number>                         # Close issue
gh issue reopen <number>                        # Reopen issue
gh issue comment <number> --body "..."          # Comment on issue
gh issue edit <number> --title "..." --body "..." # Edit issue
gh issue status                                 # Show issues assigned to you
```

### Pull Requests
```bash
gh pr list --limit 10                           # List PRs
gh pr list --repo owner/repo --state open
gh pr view <number>                             # View PR details
gh pr view <number> --repo owner/repo
gh pr create --title "..." --body "..."         # Create PR from current branch
gh pr create --repo owner/repo --head branch --base main --title "..." --body "..."
gh pr checkout <number>                         # Checkout a PR locally
gh pr diff <number>                             # View PR diff
gh pr review <number> --approve                 # Approve a PR
gh pr review <number> --comment -b "..."        # Comment on PR
gh pr review <number> --request-changes -b "..." # Request changes
gh pr merge <number> --squash                   # Merge PR (--squash, --rebase, --merge)
gh pr merge <number> --auto --squash            # Auto-merge when checks pass
gh pr close <number>                            # Close PR
gh pr checks <number>                           # Check CI status
gh pr comment <number> --body "..."             # Add comment
```

### Repositories
```bash
gh repo clone owner/repo [dir]                  # Clone repo
gh repo create name --public --description "..." # Create new public repo
gh repo create name --private                   # Create new private repo
gh repo fork owner/repo --clone                 # Fork and clone
gh repo view owner/repo                         # View repo details
gh repo view --json name,description,stars,forks,language,topics
gh repo list owner                              # List repos for user/org
gh repo list --limit 20
gh repo delete owner/repo --yes                 # Delete repo (careful!)
gh repo archive owner/repo                      # Archive repo
```

### Code Search
```bash
gh search repos "query" --limit 10              # Search repositories
gh search code "functionName" --repo owner/repo # Search code in repo
gh search issues "bug" --repo owner/repo        # Search issues
gh search prs "feature" --repo owner/repo       # Search PRs
gh search commits "fix" --repo owner/repo       # Search commits
```

### Gists
```bash
gh gist create file.txt -d "description"        # Create public gist
gh gist create file.txt --public                # Explicitly public
gh gist create file.txt --secret                # Create secret gist
gh gist list                                     # List your gists
gh gist view <id>                                # View gist
gh gist edit <id> -a "new content"              # Add file to gist
gh gist delete <id>                              # Delete gist
```

### Releases
```bash
gh release list --limit 10                      # List releases
gh release create v1.0.0 --title "..." --notes "..."
gh release create v1.0.0 --generate-notes       # Auto-generate notes
gh release upload v1.0.0 artifact.tar.gz        # Upload asset
gh release download v1.0.0                      # Download release assets
gh release view v1.0.0                          # View release details
```

### Workflows / Actions
```bash
gh run list --limit 10                          # List workflow runs
gh run view <run-id>                            # View run details
gh run watch <run-id>                           # Watch run live
gh run rerun <run-id>                           # Re-run failed job
gh workflow list                                # List workflows
gh workflow run <name> --ref branch             # Trigger workflow
gh workflow view <name>                         # View workflow details
```

### Tips
- When not inside a git repo, always use `--repo owner/repo`
- Use `--json` for structured output: `gh issue list --json number,title,state,labels`
- Use `--limit` to control result count (default varies)
- Pipe to `jq` for filtering: `gh issue list --json number,title | jq '.[].title'`
- gh commands work from any directory when `--repo` is specified
- Run `gh api <endpoint>` for anything not covered above
