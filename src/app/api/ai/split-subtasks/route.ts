import { NextRequest, NextResponse } from "next/server";
import { aiErrorResponse, chatJSON } from "@/lib/ai-client";

// POST /api/ai/split-subtasks
// Body: { title: string, description?: string }
// Returns: { subtasks: Array<{ title: string; dueDate?: string | null }> }
//
// The LLM is asked to break the given task title into 3-6 concrete
// actionable subtasks. We return only titles (and optional suggested
// due offsets) — the frontend is responsible for generating ids and
// letting the user edit/remove before saving.

interface SubtaskSuggestion {
  title: string;
  rationale?: string;
}

export async function POST(req: NextRequest) {
  let body: { title?: string; description?: string };
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

  try {
    const result = await chatJSON<{ subtasks: SubtaskSuggestion[] }>(
      [
        {
          role: "system",
          content:
            "你是任务拆解助手。给定一个任务标题（和可选描述），把它拆成 3-6 个具体可执行的子任务。" +
            "每个子任务标题不超过 30 字，动词开头，独立可完成。" +
            '返回 JSON 格式：{"subtasks":[{"title":"子任务标题","rationale":"简短理由（可选）"}]}。' +
            "不要返回任何额外文字。",
        },
        {
          role: "user",
          content: `任务标题：${title}${description ? `\n任务描述：${description}` : ""}`,
        },
      ],
      { temperature: 0.7 },
    );

    const subtasks = (result.subtasks ?? [])
      .filter((s) => s && typeof s.title === "string" && s.title.trim())
      .map((s) => ({ title: s.title.trim(), rationale: s.rationale }))
      .slice(0, 6);

    if (subtasks.length === 0) {
      return NextResponse.json(
        { error: "AI 未能生成有效的子任务，请重试或手动添加" },
        { status: 422 },
      );
    }

    return NextResponse.json({ subtasks });
  } catch (err) {
    const { status, body: errBody } = aiErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
