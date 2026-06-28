import { NextResponse } from "next/server";
import { db, checkDb } from "@/lib/db";
import { rowToTask } from "@/lib/task-serializer";
import { aiErrorResponse, chatJSON } from "@/lib/ai-client";
import type { TaskData } from "@/lib/task-utils";

// GET /api/ai/daily-focus
// Returns: { picks: Array<{ taskId, reason }>, summary: string }
//
// Picks 1-3 tasks the user should focus on today, based on:
//   - due date (overdue / due today → higher priority)
//   - task priority
//   - status (todo / in_progress only)
//   - dependencies (if A blocks B, A goes first)
//   - subtask progress
// The LLM receives a compact task list and returns picks with reasons.

interface AIPick {
  taskId: string;
  reason: string;
}

export async function GET() {
  const dbCheck = await checkDb();
  if (!dbCheck.ok) {
    return NextResponse.json(
      { error: "数据库连接失败", hint: dbCheck.hint },
      { status: 503 },
    );
  }

  const rows = await db.task.findMany();
  const allTasks = rows
    .map(rowToTask)
    .filter((t) => t.deletedAt === null);

  // Filter to actionable tasks
  const active = allTasks.filter(
    (t) => t.status === "todo" || t.status === "in_progress",
  );

  if (active.length === 0) {
    return NextResponse.json({
      picks: [],
      summary: "当前没有进行中或待办的任务，享受片刻闲暇吧。",
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  // Build a compact task summary for the LLM (avoid sending full notes etc.)
  const compact = active.map((t) => {
    const subDone = t.subtasks.filter((s) => s.done).length;
    const subTotal = t.subtasks.length;
    return {
      id: t.id,
      title: t.title,
      priority: t.priority,
      status: t.status,
      dueDate: t.dueDate,
      tags: t.tags,
      overdue: t.dueDate ? t.dueDate < today : false,
      dueToday: t.dueDate === today,
      subtaskProgress: subTotal > 0 ? `${subDone}/${subTotal}` : null,
      dependsOn: t.dependsOn,
      pomodoros: t.pomodoros,
    };
  });

  try {
    const result = await chatJSON<{
      picks: AIPick[];
      summary: string;
    }>(
      [
        {
          role: "system",
          content:
            "你是任务优先级助手。基于用户的任务列表，挑出今天最值得优先处理的 1-3 个任务。" +
            "考虑因素：逾期 > 截止今天 > 高优先级 > 进行中 > 有依赖阻塞。" +
            "reason 用一句话说明为什么选这个任务（不超过 30 字）。" +
            "summary 用一句话鼓励用户（不超过 40 字）。" +
            '返回 JSON：{"picks":[{"taskId":"...","reason":"..."}],"summary":"..."}。' +
            "taskId 必须从提供的任务列表里选，不要编造。不要返回任何额外文字。",
        },
        {
          role: "user",
          content: `当前任务列表（共 ${compact.length} 个待办/进行中）：\n${JSON.stringify(compact, null, 2)}`,
        },
      ],
      { temperature: 0.5 },
    );

    // Validate pick IDs exist
    const validIds = new Set(active.map((t) => t.id));
    const picks = (result.picks ?? [])
      .filter((p) => p && typeof p.taskId === "string" && validIds.has(p.taskId))
      .slice(0, 3);

    const summary =
      typeof result.summary === "string" && result.summary.trim()
        ? result.summary.trim()
        : `今天有 ${active.length} 个任务待处理，挑了 ${picks.length} 个重点。`;

    return NextResponse.json({ picks, summary });
  } catch (err) {
    const { status, body: errBody } = aiErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}

// Re-export TaskData type to keep file self-documenting
export type { TaskData };
