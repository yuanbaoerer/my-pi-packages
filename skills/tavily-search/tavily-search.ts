/**
 * Tavily Search Extension
 *
 * Registers the `tavily_search` tool using the Tavily Search API.
 * Requires TAVILY_API_KEY environment variable.
 *
 * Install: Place in ~/.pi/agent/extensions/ or set in settings.json
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";

// ---- Schemas ----

const TavilySearchParams = Type.Object({
  query: Type.String({ description: "Search query string" }),
  search_depth: Type.Optional(
    Type.Union(
      [Type.Literal("basic"), Type.Literal("advanced")],
      { default: "basic", description: "Search depth: basic (faster) or advanced (more comprehensive)" },
    ),
  ),
  max_results: Type.Optional(
    Type.Number({ default: 10, description: "Maximum number of results (1-20)" }),
  ),
  include_answer: Type.Optional(
    Type.Boolean({ default: true, description: "Include an AI-generated answer summarizing the search results" }),
  ),
  include_raw_content: Type.Optional(
    Type.Boolean({ default: false, description: "Include raw page content (uses more tokens)" }),
  ),
  include_images: Type.Optional(
    Type.Boolean({ default: false, description: "Include image results if available" }),
  ),
});

type TavilySearchInput = Static<typeof TavilySearchParams>;

// ---- Tavily API response types ----

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string;
}

interface TavilyImage {
  url: string;
  description?: string;
}

interface TavilyResponse {
  query: string;
  answer?: string;
  results: TavilyResult[];
  images?: TavilyImage[];
  response_time: number;
}

// ---- Extension ----

export default function tavilySearchExtension(pi: ExtensionAPI) {
  const TAVILY_API_URL = "https://api.tavily.com/search";

  function getApiKey(): string {
    const key = process.env.TAVILY_API_KEY;
    if (!key) {
      throw new Error(
        "TAVILY_API_KEY environment variable is not set. Get a key at https://app.tavily.com and set: export TAVILY_API_KEY='tvly-...'",
      );
    }
    return key;
  }

  pi.registerTool({
    name: "tavily_search",
    label: "Tavily Search",
    description:
      "Search the web using Tavily Search API, optimized for LLMs. Returns structured results with titles, URLs, content snippets, and an optional AI-generated answer. Use for real-time information, current events, facts, and any web search needs.",
    promptSnippet: "Search the web via Tavily API and return structured results",
    promptGuidelines: [
      "Use tavily_search when you need real-time or current information from the web.",
      "Use tavily_search for fact-checking, news, recent events, or documentation lookups.",
      "For comprehensive searches, use search_depth: 'advanced'; for quick lookups use 'basic'.",
      "Set include_raw_content: true only when you need full page text, as it increases token usage significantly.",
    ],
    parameters: TavilySearchParams,
    async execute(_toolCallId, params: TavilySearchInput, signal) {
      const apiKey = getApiKey();

      const body: Record<string, unknown> = {
        api_key: apiKey,
        query: params.query,
        search_depth: params.search_depth ?? "basic",
        max_results: Math.min(params.max_results ?? 10, 20),
        include_answer: params.include_answer ?? true,
        include_raw_content: params.include_raw_content ?? false,
        include_images: params.include_images ?? false,
      };

      const response = await fetch(TAVILY_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tavily API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as TavilyResponse;

      // Build output text
      const lines: string[] = [];

      if (data.answer) {
        lines.push(`## Answer\n${data.answer}\n`);
      }

      lines.push(`## Search Results (${data.results.length})`);
      for (let i = 0; i < data.results.length; i++) {
        const r = data.results[i];
        lines.push(`\n### ${i + 1}. ${r.title}`);
        lines.push(`**URL:** ${r.url}`);
        lines.push(`**Score:** ${r.score.toFixed(2)}`);
        lines.push(`${r.content}`);
        if (r.raw_content) {
          lines.push(`\n<details><summary>Raw Content</summary>\n\n${r.raw_content}\n\n</details>`);
        }
      }

      if (data.images && data.images.length > 0) {
        lines.push(`\n## Images (${data.images.length})`);
        for (const img of data.images) {
          lines.push(`- ${img.description ?? "Image"}: ${img.url}`);
        }
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: {
          query: data.query,
          resultCount: data.results.length,
          responseTime: data.response_time,
          hasAnswer: !!data.answer,
          hasImages: !!(data.images && data.images.length > 0),
          topResults: data.results.slice(0, 5).map((r) => ({
            title: r.title,
            url: r.url,
            score: r.score,
          })),
        },
      };
    },
  });

  // Notify on session start about API key status
  pi.on("session_start", (_event, ctx) => {
    if (!process.env.TAVILY_API_KEY) {
      ctx.ui.notify(
        "Tavily Search: TAVILY_API_KEY not set. Get a key at https://app.tavily.com",
        "warning",
      );
    } else {
      ctx.ui.notify("Tavily Search: ready", "info");
    }
  });
}
