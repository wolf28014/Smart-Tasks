// Unified ZAI (GLM) client wrapper for all AI features.
//
// All server-side AI calls go through this module so we have a single
// place to:
//   - lazily initialize the ZAI client (using the user-configured
//     .z-ai-config file written by /api/ai/settings)
//   - check whether AI is enabled before making any call
//   - strip markdown code fences from JSON responses
//   - centralize error handling

import ZAI from "z-ai-web-dev-sdk";
import type { ChatMessage } from "z-ai-web-dev-sdk";
import { readAIConfig } from "@/app/api/ai/settings/route";

// Lazily-created client. We re-read the config on first use (not at
// module load time) so the user's settings take effect without
// restarting the dev server.
let _client: ZAI | null = null;
let _clientConfigKey: string | null = null;

/** Check whether AI is enabled and configured. */
export function isAIEnabled(): boolean {
  const cfg = readAIConfig();
  return cfg.enabled && !!cfg.apiKey;
}

/** Get the shared ZAI client (lazily initialized from .z-ai-config). */
export async function getClient(): Promise<ZAI> {
  const cfg = readAIConfig();

  // Build a cache key from the config fields that affect the client
  // identity. If any of these change, we recreate the client.
  const cacheKey = `${cfg.baseUrl}|${cfg.apiKey}`;
  if (_client && _clientConfigKey === cacheKey) {
    return _client;
  }

  if (!cfg.apiKey) {
    throw new Error("AI 未配置：请先在设置中填写 API Key");
  }

  // ZAI.create() reads from .z-ai-config on disk. Since /api/ai/settings
  // writes that file, calling ZAI.create() here picks up the latest
  // config.
  _client = await ZAI.create();
  _clientConfigKey = cacheKey;
  return _client;
}

/** Reset the cached client (used when settings change). */
export function resetClient(): void {
  _client = null;
  _clientConfigKey = null;
}

/**
 * Send a chat completion request and return the assistant's text reply.
 *
 * Use this for non-streaming, non-tool calls. For structured JSON
 * output, pass `json: true` and the helper will strip markdown code
 * fences and parse the result.
 */
export async function chat(
  messages: ChatMessage[],
  opts: {
    model?: string;
    json?: boolean;
    temperature?: number;
  } = {},
): Promise<string> {
  if (!isAIEnabled()) {
    throw new Error("AI 功能未启用：请在设置中开启");
  }
  const client = await getClient();
  const cfg = readAIConfig();
  const body: Record<string, unknown> = {
    model: opts.model || cfg.model || "glm-4-plus",
    messages,
    thinking: { type: "disabled" },
  };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.json) {
    body.response_format = { type: "json_object" };
  }
  const res = (await client.chat.completions.create(
    body as Parameters<typeof client.chat.completions.create>[0],
  )) as {
    choices: { message: { content: string } }[];
  };
  const content = res.choices?.[0]?.message?.content ?? "";
  return content;
}

/**
 * Send a chat completion request and parse the reply as JSON.
 *
 * Strips ```json fences if present, then JSON.parses. Throws with a
 * descriptive message if parsing fails so the caller can return a
 * friendly error to the frontend.
 */
export async function chatJSON<T = unknown>(
  messages: ChatMessage[],
  opts: { model?: string; temperature?: number } = {},
): Promise<T> {
  const raw = await chat(messages, { ...opts, json: true });
  const cleaned = stripCodeFence(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(
      `AI 返回的 JSON 解析失败: ${err instanceof Error ? err.message : String(err)}。原始内容: ${raw.slice(0, 300)}`,
    );
  }
}

/** Remove ```json ... ``` or ``` ... ``` fences around a string. */
export function stripCodeFence(s: string): string {
  if (!s) return s;
  let out = s.trim();
  // ```json\n...\n```  or  ```\n...\n```
  const fenceMatch = out.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i);
  if (fenceMatch) {
    out = fenceMatch[1];
  }
  return out.trim();
}

/** Wrap an async AI handler with friendly error JSON for NextResponse. */
export function aiErrorResponse(err: unknown): {
  status: number;
  body: { error: string; detail?: string };
} {
  const message = err instanceof Error ? err.message : String(err);
  // Common transient failures
  if (/timeout|network|ECONNRESET|fetch failed/i.test(message)) {
    return {
      status: 504,
      body: {
        error: "AI 服务暂时不可用，请稍后重试",
        detail: message,
      },
    };
  }
  if (/未配置|未启用|Configuration file not found|apiKey/i.test(message)) {
    return {
      status: 503,
      body: {
        error: "AI 服务未配置，请在设置中开启",
        detail: message,
      },
    };
  }
  return {
    status: 500,
    body: { error: "AI 处理失败", detail: message },
  };
}
