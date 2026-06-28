import { NextRequest, NextResponse } from "next/server";
import { aiErrorResponse, chatJSON } from "@/lib/ai-client";

// POST /api/ai/parse-task
// Body: { text: string, existingTags?: string[] }
// Returns: { task: { title, description?, dueDate?, priority?, tags?[] } }
//
// Parses a natural-language task description like
//   "明天下午 3 点开会讨论 Q3 规划，记得准备 PPT"
// into a structured task draft the frontend can pre-fill into the
// TaskDialog. Tags are suggested from existingTags when possible.

interface ParsedTask {
  title: string;
  description?: string;
  dueDate?: string | null; // YYYY-MM-DD
  priority?: "low" | "medium" | "high";
  tags?: string[];
}

export async function POST(req: NextRequest) {
  let body: { text?: string; existingTags?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "输入不能为空" }, { status: 400 });
  }

  const existingTags = Array.isArray(body.existingTags) ? body.existingTags : [];

  // Build a "today" anchor so the LLM can resolve relative dates.
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const dayOfWeek = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][today.getDay()];

  try {
    const result = await chatJSON<{ task: ParsedTask }>(
      [
        {
          role: "system",
          content:
            "你是任务解析助手。把用户的自然语言描述解析成结构化任务。" +
            `今天是 ${todayISO}（${dayOfWeek}）。解析相对日期（明天/下周三/月底等）为 YYYY-MM-DD 格式。` +
            "如果没明确截止日期，dueDate 返回 null。" +
            "priority 根据紧急程度判断：含「紧急/立即/马上」等词为 high，含「抽空/有空/不急」为 low，其余 medium。" +
            "从已有标签列表里挑匹配的，也可建议新标签（不超过 3 个）。" +
            "title 提炼核心动作，不超过 40 字；description 保留细节。" +
            '返回 JSON：{"task":{"title":"...","description":"...","dueDate":"YYYY-MM-DD或null","priority":"low|medium|high","tags":["..."]}}。' +
            "不要返回任何额外文字。",
        },
        {
          role: "user",
          content:
            `用户输入：${text}` +
            (existingTags.length > 0
              ? `\n已有标签：${existingTags.join("、")}`
              : ""),
        },
      ],
      { temperature: 0.3 },
    );

    const task = result.task;
    if (!task || typeof task.title !== "string" || !task.title.trim()) {
      return NextResponse.json(
        { error: "AI 未能解析出有效任务，请重试或手动创建" },
        { status: 422 },
      );
    }

    // Sanitize: clamp priority, filter tags
    const sanitized: ParsedTask = {
      title: task.title.trim().slice(0, 100),
      description: task.description?.trim() || undefined,
      dueDate:
        typeof task.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate)
          ? task.dueDate
          : null,
      priority:
        task.priority === "low" || task.priority === "medium" || task.priority === "high"
          ? task.priority
          : "medium",
      tags: Array.isArray(task.tags)
        ? task.tags
            .filter((t) => typeof t === "string" && t.trim())
            .map((t) => t.trim().replace(/^#/, ""))
            .slice(0, 5)
        : [],
    };

    return NextResponse.json({ task: sanitized });
  } catch (err) {
    const { status, body: errBody } = aiErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
