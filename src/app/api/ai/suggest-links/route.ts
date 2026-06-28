import { NextRequest, NextResponse } from "next/server";
import { db, checkDb } from "@/lib/db";
import { rowToTask } from "@/lib/task-serializer";
import { aiErrorResponse, chatJSON } from "@/lib/ai-client";

// POST /api/ai/suggest-links
// Body: { noteContent: string, currentTaskId?: string }
// Returns: { suggestions: Array<{ taskId, title, reason }> }
//
// Recommends 3 tasks that are semantically related to the note content,
// so the user can add [[wikilinks]] to connect them.

export async function POST(req: NextRequest) {
  const dbCheck = await checkDb();
  if (!dbCheck.ok) {
    return NextResponse.json(
      { error: "数据库连接失败", hint: dbCheck.hint },
      { status: 503 },
    );
  }

  let body: { noteContent?: string; currentTaskId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const noteContent = (body.noteContent ?? "").trim();
  if (!noteContent || noteContent.length < 10) {
    return NextResponse.json({ suggestions: [] });
  }

  const rows = await db.task.findMany();
  const candidates = rows
    .map(rowToTask)
    .filter(
      (t) => t.deletedAt === null && t.id !== body.currentTaskId,
    )
    .slice(0, 50) // limit to 50 candidates for prompt size
    .map((t) => ({
      id: t.id,
      title: t.title,
      tags: t.tags,
      description: t.description?.slice(0, 80),
    }));

  if (candidates.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const result = await chatJSON<{
      suggestions: Array<{ taskId: string; reason: string }>;
    }>(
      [
        {
          role: "system",
          content:
            "你是任务关联推荐助手。用户正在编辑一条笔记，根据笔记内容，从现有任务中推荐 3 个最相关的任务，方便建立双向关联。" +
            "reason 一句话说明为什么相关（不超过 20 字）。" +
            "taskId 必须从提供的候选列表里选。" +
            '返回 JSON：{"suggestions":[{"taskId":"...","reason":"..."}]}。',
        },
        {
          role: "user",
          content:
            `笔记内容（前300字）：${noteContent.slice(0, 300)}\n\n候选任务：${JSON.stringify(candidates)}`,
        },
      ],
      { temperature: 0.4 },
    );

    // Validate taskIds exist
    const validIds = new Set(candidates.map((c) => c.id));
    const suggestions = (result.suggestions ?? [])
      .filter((s) => s && validIds.has(s.taskId))
      .slice(0, 3);

    // Enrich with title
    const enriched = suggestions.map((s) => {
      const task = candidates.find((c) => c.id === s.taskId);
      return {
        taskId: s.taskId,
        title: task?.title ?? "",
        reason: s.reason,
      };
    });

    return NextResponse.json({ suggestions: enriched });
  } catch (err) {
    const { status, body: errBody } = aiErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
