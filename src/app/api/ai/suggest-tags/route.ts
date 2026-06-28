import { NextRequest, NextResponse } from "next/server";
import { aiErrorResponse, chatJSON } from "@/lib/ai-client";

// POST /api/ai/suggest-tags
// Body: { title: string, description?: string, existingTags: string[] }
// Returns: { suggested: string[], newCandidates: string[] }
//
// `suggested` = tags from existingTags that match this task (max 3).
// `newCandidates` = up to 2 new tag names the LLM thinks would be
// useful but don't exist yet (frontend can offer to create them).

export async function POST(req: NextRequest) {
  let body: { title?: string; description?: string; existingTags?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "任务标题不能为空" }, { status: 400 });
  }
  const description = (body.description ?? "").trim();
  const existingTags = Array.isArray(body.existingTags) ? body.existingTags : [];

  if (existingTags.length === 0) {
    // No existing tags — still suggest 1-2 new candidate tag names.
  }

  try {
    const result = await chatJSON<{
      suggested: string[];
      newCandidates: string[];
    }>(
      [
        {
          role: "system",
          content:
            "你是标签推荐助手。根据任务标题和描述，从已有标签列表中挑出最匹配的 1-3 个标签。" +
            "如果没有合适的已有标签，可以建议 1-2 个新的标签名（不超过 4 个字，简洁通用）。" +
            "标签名不带 # 号。" +
            '返回 JSON：{"suggested":["已有标签名"],"newCandidates":["新标签名"]}。' +
            "不要返回任何额外文字。",
        },
        {
          role: "user",
          content:
            `任务标题：${title}` +
            (description ? `\n任务描述：${description}` : "") +
            (existingTags.length > 0
              ? `\n已有标签：${existingTags.join("、")}`
              : "\n（暂无已有标签）"),
        },
      ],
      { temperature: 0.4 },
    );

    const suggested = (result.suggested ?? [])
      .filter((t) => typeof t === "string" && t.trim())
      .map((t) => t.trim().replace(/^#/, ""))
      .filter((t) => existingTags.includes(t))
      .slice(0, 3);

    const newCandidates = (result.newCandidates ?? [])
      .filter((t) => typeof t === "string" && t.trim())
      .map((t) => t.trim().replace(/^#/, ""))
      .filter((t) => !existingTags.includes(t) && !suggested.includes(t))
      .slice(0, 2);

    return NextResponse.json({ suggested, newCandidates });
  } catch (err) {
    const { status, body: errBody } = aiErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
