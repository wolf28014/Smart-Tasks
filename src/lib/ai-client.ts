// Unified ZAI (GLM) client wrapper for all AI features.
//
// All server-side AI calls go through this module so we have a single
// place to:
//   - lazily initialize the ZAI client
//   - strip markdown code fences from JSON responses
//   - provide typed helpers for common operations
//   - centralize error handling

import ZAI from "z-ai-web-dev-sdk";
import type { ChatMessage } from "z-ai-web-dev-sdk";

let _client: ZAI | null = null;

/** Get the shared ZAI client (lazily initialized). */
export async function getClient(): Promise<ZAI> {
  if (!_client) {
    _client = await ZAI.create();
  }
  return _client;
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
  const client = await getClient();
  const body: Record<string, unknown> = {
    messages,
    thinking: { type: "disabled" },
  };
  if (opts.model) body.model = opts.model;
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
  if (/Configuration file not found|apiKey/i.test(message)) {
    return {
      status: 503,
      body: {
        error: "AI 服务未配置，请联系管理员",
        detail: message,
      },
    };
  }
  return {
    status: 500,
    body: { error: "AI 处理失败", detail: message },
  };
}
