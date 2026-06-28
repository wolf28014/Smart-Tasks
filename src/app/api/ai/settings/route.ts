import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

// Configuration file location.
//
// The z-ai-web-dev-sdk reads from (in order):
//   1. process.cwd()/.z-ai-config
//   2. os.homedir()/.z-ai-config
//   3. /etc/.z-ai-config
//
// We use option 1 (project-local) so each Smart-Tasks install can have
// its own AI config, and so the user can edit it from the UI without
// touching system files.

function getConfigPath(): string {
  return path.join(process.cwd(), ".z-ai-config");
}

interface AIConfig {
  baseUrl: string;
  apiKey: string;
  model?: string;
  enabled: boolean;
  semanticSearch?: boolean; // ③ semantic search default on/off
}

const DEFAULT_CONFIG: AIConfig = {
  baseUrl: "https://api.z.ai/api/paas/v4",
  apiKey: "",
  model: "glm-4-plus",
  enabled: false,
  semanticSearch: true, // default ON per user request
};

// Read config from file. Returns default if file doesn't exist or is
// malformed (never throws — settings page handles the "not configured"
// state gracefully).
//
// Fallback chain:
//   1. <project>/.z-ai-config (user-configured via settings UI)
//   2. /etc/.z-ai-config (system-level, e.g. sandbox/dev environments)
//   3. defaults (disabled)
//
// When falling back to /etc/.z-ai-config, we treat AI as enabled
// because the system config is assumed to be valid.
export function readAIConfig(): AIConfig {
  const cfgPath = getConfigPath();
  try {
    const raw = fs.readFileSync(cfgPath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : DEFAULT_CONFIG.baseUrl,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model: typeof parsed.model === "string" ? parsed.model : DEFAULT_CONFIG.model,
      enabled: parsed.enabled !== false,
      semanticSearch: parsed.semanticSearch !== false, // default true
    };
  } catch {
    // Project config doesn't exist — try system config
    try {
      const sysPath = "/etc/.z-ai-config";
      const sysRaw = fs.readFileSync(sysPath, "utf-8");
      const sysParsed = JSON.parse(sysRaw);
      return {
        baseUrl: sysParsed.baseUrl || DEFAULT_CONFIG.baseUrl,
        apiKey: sysParsed.apiKey || "",
        model: sysParsed.model || DEFAULT_CONFIG.model,
        enabled: true,
        semanticSearch: true, // default on for system config too
      };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }
}

// Write config to file. Creates the file if it doesn't exist.
export function writeAIConfig(cfg: AIConfig): void {
  const cfgPath = getConfigPath();
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf-8");
}

// GET /api/ai/settings — return current AI config.
// IMPORTANT: the apiKey is masked so we don't leak it to the browser
// on every page load. The frontend only needs to know whether a key
// is set, not its value.
export async function GET() {
  const cfg = readAIConfig();
  return NextResponse.json({
    baseUrl: cfg.baseUrl,
    model: cfg.model,
    enabled: cfg.enabled,
    semanticSearch: cfg.semanticSearch,
    hasApiKey: !!cfg.apiKey,
    apiKeyPreview: cfg.apiKey ? maskKey(cfg.apiKey) : "",
  });
}

export async function PUT(req: NextRequest) {
  let body: {
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    enabled?: boolean;
    semanticSearch?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const current = readAIConfig();
  const next: AIConfig = {
    baseUrl:
      typeof body.baseUrl === "string" && body.baseUrl.trim()
        ? body.baseUrl.trim()
        : current.baseUrl,
    apiKey:
      typeof body.apiKey === "string"
        ? body.apiKey.trim()
        : current.apiKey,
    model:
      typeof body.model === "string" && body.model.trim()
        ? body.model.trim()
        : current.model,
    enabled: typeof body.enabled === "boolean" ? body.enabled : current.enabled,
    semanticSearch:
      typeof body.semanticSearch === "boolean"
        ? body.semanticSearch
        : current.semanticSearch,
  };

  // Validate: if enabling AI, must have apiKey
  if (next.enabled && !next.apiKey) {
    return NextResponse.json(
      { error: "启用 AI 功能前需要先填写 API Key" },
      { status: 400 },
    );
  }

  try {
    writeAIConfig(next);
    return NextResponse.json({
      ok: true,
      config: {
        baseUrl: next.baseUrl,
        model: next.model,
        enabled: next.enabled,
        semanticSearch: next.semanticSearch,
        hasApiKey: !!next.apiKey,
        apiKeyPreview: maskKey(next.apiKey),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "保存配置失败", detail: message },
      { status: 500 },
    );
  }
}

function maskKey(key: string): string {
  if (key.length <= 8) return "•".repeat(key.length);
  return key.slice(0, 4) + "•".repeat(Math.max(4, key.length - 8)) + key.slice(-4);
}
