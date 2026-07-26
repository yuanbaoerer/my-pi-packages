---
name: tavily-search
description: Real-time web search via Tavily Search API. Use when the user asks for current information, news, or any web content that requires up-to-date search results.
---

# Tavily Search

Web search via the [Tavily Search API](https://docs.tavily.com/), optimized for LLMs.

## Setup

Set your Tavily API key as an environment variable. Get one at https://app.tavily.com:

```bash
export TAVILY_API_KEY="tvly-..."
```

Add this to `~/.bashrc` or `~/.zshrc` for persistent use.

The `tavily_search` tool is registered by the companion extension. To install it:

```bash
cp ~/.pi/agent/skills/tavily-search/tavily-search.ts ~/.pi/agent/extensions/
```

Then reload pi with `/reload`.

## Usage

The `tavily_search` tool is available to the agent. Key parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | (required) | Search query |
| `search_depth` | "basic" \| "advanced" | "basic" | basic is faster; advanced returns more comprehensive results |
| `max_results` | number | 10 | Number of results (max 20) |
| `include_answer` | boolean | true | Include an LLM-generated summary of search results |
| `include_raw_content` | boolean | false | Include full raw page content (uses more tokens) |
| `include_images` | boolean | false | Include images if available |

The tool returns:
- `answer`: AI-generated summary of search results (when `include_answer: true`)
- `results`: Array of search results with `title`, `url`, `content`, `score`
- `images`: Array of relevant images (when `include_images: true`)
