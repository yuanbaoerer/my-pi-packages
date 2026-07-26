/**
 * last30days-agent extension for pi
 *
 * 提供一个隔离的 sub-agent 来运行 last30days skill，不影响全局 pi 配置。
 *
 * 使用方式:
 *   /last30days nvidia earnings reaction       <- 直接命令
 *   "帮我用 last30days 调研一下 AI agent 趋势"   <- 自然语言，agent 自动调用 tool
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { Type } from "typebox";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Resolve skill directory relative to this extension file (inside the package)
const __dirname = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = resolve(__dirname, "..");
const SKILL_DIR = resolve(PACKAGE_ROOT, "skills/last30days");
const SKILL_FILE = resolve(SKILL_DIR, "SKILL.md");

export default function (pi: ExtensionAPI) {
  // ============================================================
  // 1. 注册 custom tool —— pi 的 agent 可以自然调用
  // ============================================================
  pi.registerTool({
    name: "last30days_research",
    label: "Last30days Research",
    description:
      "使用 last30days 引擎调研任意话题在最近 30 天内的全网讨论情况。" +
      "跨 Reddit、X/Twitter、YouTube、TikTok、Hacker News、Polymarket、GitHub 和多平台网页搜索，" +
      "综合生成有据可查的研究报告。适合市场调研、竞品分析、舆情监测。",
    promptSnippet:
      "使用 last30days 引擎调研话题: <topic>。返回包含来源引用和互动数据的综合报告。",
    promptGuidelines: [
      "当用户需要调研某个话题在最近30天内的网络讨论热度、舆情趋势时，使用 last30days_research 工具。",
      "last30days_research 工具接受一个英文或中文话题字符串作为参数。",
    ],
    parameters: Type.Object({
      topic: Type.String({
        description:
          "要调研的话题（英文效果最佳）。例如: 'nvidia earnings reaction', 'AI agent trends', 'react 19 adoption'",
      }),
    }),

    async execute(toolCallId, params, _signal, onUpdate) {
      const topic = params.topic?.trim();
      if (!topic) {
        return {
          content: [{ type: "text", text: "错误: 请提供调研话题" }],
          details: {},
        };
      }

      onUpdate?.({
        content: [
          {
            type: "text",
            text: `🔍 正在启动隔离的 last30days Agent 调研: "${topic}"...\n\n`,
          },
        ],
      });

      // 动态导入 SDK（只在 tool 被调用时才加载）
      const {
        createAgentSession,
        DefaultResourceLoader,
        SessionManager,
        ModelRuntime,
      } = await import("@earendil-works/pi-coding-agent");

      const modelRuntime = await ModelRuntime.create();
      const available = await modelRuntime.getAvailable();
      if (available.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "错误: 没有可用的 AI 模型。请先配置 API key。",
            },
          ],
          details: {},
        };
      }

      // 构造只含 last30days skill 的 ResourceLoader
      const loader = new DefaultResourceLoader({
        cwd: SKILL_DIR,
        skillsOverride: (current) => ({
          skills: [
            {
              name: "last30days",
              description:
                "Research any topic from the last 30 days across Reddit, X, YouTube, TikTok, Hacker News, Polymarket, GitHub, and the web. Pulls posts, comments, engagement, and synthesizes a grounded summary.",
              filePath: SKILL_FILE,
              baseDir: SKILL_DIR,
              source: "last30days",
            },
          ],
          diagnostics: current.diagnostics,
        }),
        promptsOverride: () => ({ prompts: [], diagnostics: [] }),
        agentsFilesOverride: () => ({ agentsFiles: [] }),
      });
      await loader.reload();

      const { session } = await createAgentSession({
        resourceLoader: loader,
        sessionManager: SessionManager.inMemory(),
        modelRuntime,
        model: available[0],
        thinkingLevel: "off",
        cwd: SKILL_DIR,
        tools: ["read", "bash", "write", "edit"],
      });

      // 收集子 agent 输出
      const chunks: string[] = [];
      session.subscribe((event) => {
        if (event.type === "message_update") {
          if (event.assistantMessageEvent.type === "text_delta") {
            chunks.push(event.assistantMessageEvent.delta);
          }
          // 实时反馈进度
          if (event.assistantMessageEvent.type === "tool_use") {
            onUpdate?.({
              content: [
                {
                  type: "text",
                  text: `⏳ 执行中: ${event.assistantMessageEvent.toolName}...\n`,
                },
              ],
            });
          }
        }
      });

      let result: string;
      try {
        await session.prompt(
          `/last30days ${topic}\n\n` +
            `IMPORTANT: Read SKILL.md thoroughly before executing any research. ` +
            `Follow all steps in the skill instructions. ` +
            `Produce a complete research report with source citations and engagement data. ` +
            `Output in Chinese if the topic is about Chinese market, otherwise in English.`,
        );
        result = chunks.join("");
      } catch (err: any) {
        result = `last30days 调研出错: ${err.message}\n\n已收集的部分结果:\n${chunks.join("")}`;
      } finally {
        session.dispose();
      }

      return {
        content: [{ type: "text", text: result || "(引擎未返回内容)" }],
        details: {
          topic,
          outputLength: result.length,
        },
      };
    },
  });

  // ============================================================
  // 2. 注册命令 /last30days —— 快捷方式
  // ============================================================
  pi.registerCommand("last30days", {
    description:
      "隔离调研话题（Reddit/X/YouTube/HN/Polymarket/GitHub/Web）",
    async handler(args, ctx) {
      const topic = args?.trim();
      if (!topic) {
        ctx.ui.notify(
          "用法: /last30days <话题>\n例如: /last30days nvidia earnings reaction",
          "error",
        );
        return;
      }

      // 让当前 pi agent 调用 last30days_research tool 来执行
      pi.sendUserMessage(
        `请使用 last30days_research 工具调研以下话题，输出完整的研究报告：\n\n${topic}`,
      );
    },
  });
}
