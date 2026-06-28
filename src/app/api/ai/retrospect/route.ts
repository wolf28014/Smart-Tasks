import { NextRequest, NextResponse } from "next/server";
import { db, checkDb } from "@/lib/db";
import { rowToTask } from "@/lib/task-serializer";
import { aiErrorResponse, chatJSON } from "@/lib/ai-client";

// POST /api/ai/retrospect
// Body: { taskId: string }
// Returns: { retrospect: string, summary: string }
//
// Generates a 3-sentence retrospective for a completed task based on:
//   - pomodoro count (effort)
//   - time taken (createdAt → completedAt)
//   - subtask completion ratio
//   - existing notes
// The `retrospect` is a Markdown block to append to the task's notes.
// The `summary` is a one-liner for the toast notification.

export async function POST(req: NextRequest) {
  const dbCheck = await checkDb();
  if (!dbCheck.ok) {
    return NextResponse.json(
      { error: "数据库连接失败", hint: dbCheck.hint },
      { status: 503 },
    );
  }

  let body: { taskId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const taskId = body.taskId;
  if (!taskId) {
    return NextResponse.json({ error: "taskId 不能为空" }, { status: 400 });
  }

  const taskRow = await db.task.findUnique({ where: { id: taskId } });
  if (!taskRow) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  const task = rowToTask(taskRow);

  // Compute metrics
  const subTotal = task.subtasks.length;
  const subDone = task.subtasks.filter((s) => s.done).length;
  const createdAt = new Date(task.createdAt);
  const completedAt = task.completedAt ? new Date(task.completedAt) : new Date();
  const hoursTaken = Math.round(
    (completedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60),
  );
  const daysTaken = Math.round(hoursTaken / 24);

  const metrics = {
    title: task.title,
    priority: task.priority,
    pomodoros: task.pomodoros,
    subtaskProgress: subTotal > 0 ? `${subDone}/${subTotal}` : null,
    hoursTaken,
    daysTaken,
    tags: task.tags,
    hasNotes: !!task.noteMarkdown,
    noteExcerpt: task.noteMarkdown?.slice(0, 200),
  };

  try {
    const result = await chatJSON<{ retrospect: string; summary: string }>(
      [
        {
          role: "system",
          content:
            "你是任务复盘助手。根据用户刚完成的任务数据，生成简短复盘。" +
            "retrospect 是 2-3 句话的 Markdown，包含：完成情况、耗时分析、改进建议。" +
            "summary 是一句话总结（不超过 25 字），用于通知。" +
            "语气客观友好，不过度赞美。如果数据不足以分析，坦诚说明。" +
            '返回 JSON：{"retrospect":"...","summary":"..."}。',
        },
        {
          role: "user",
          content: `任务数据：\n${JSON.stringify(metrics, null, 2)}`,
        },
      ],
      { temperature: 0.6 },
    );

    const retrospect =
      typeof result.retrospect === "string" && result.retrospect.trim()
        ? result.retrospect.trim()
        : "复盘生成失败，可手动添加。";
    const summary =
      typeof result.summary === "string" && result.summary.trim()
        ? result.summary.trim()
        : "AI 复盘已完成";

    return NextResponse.json({ retrospect, summary });
  } catch (err) {
    const { status, body: errBody } = aiErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
