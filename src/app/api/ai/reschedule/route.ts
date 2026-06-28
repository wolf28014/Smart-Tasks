import { NextRequest, NextResponse } from "next/server";
import { db, checkDb } from "@/lib/db";
import { rowToTask } from "@/lib/task-serializer";
import { aiErrorResponse, chatJSON } from "@/lib/ai-client";

// POST /api/ai/reschedule
// Body: { scope?: "overdue" | "thisweek" | "all" }
// Returns: { proposals: Array<{ taskId, title, oldDueDate, newDueDate, reason }> }
//
// Proposes new due dates for tasks based on priority, dependencies,
// and current workload. Does NOT modify anything — the frontend shows
// the proposals and asks the user to confirm before applying.

export async function POST(req: NextRequest) {
  const dbCheck = await checkDb();
  if (!dbCheck.ok) {
    return NextResponse.json(
      { error: "数据库连接失败", hint: dbCheck.hint },
      { status: 503 },
    );
  }

  let body: { scope?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const scope = body.scope ?? "overdue";

  const rows = await db.task.findMany();
  let tasks = rows
    .map(rowToTask)
    .filter(
      (t) =>
        t.deletedAt === null &&
        (t.status === "todo" || t.status === "in_progress"),
    );

  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  // Filter by scope
  if (scope === "overdue") {
    tasks = tasks.filter((t) => t.dueDate && t.dueDate < today);
  } else if (scope === "thisweek") {
    tasks = tasks.filter(
      (t) => t.dueDate && t.dueDate >= today && t.dueDate <= nextWeek,
    );
  }

  if (tasks.length === 0) {
    return NextResponse.json({
      proposals: [],
      message: "当前范围内没有需要重排的任务",
    });
  }

  // Build compact task list for LLM
  const compact = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    priority: t.priority,
    dueDate: t.dueDate,
    tags: t.tags,
    pomodoros: t.pomodoros,
    subtaskProgress:
      t.subtasks.length > 0
        ? `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}`
        : null,
  }));

  try {
    const result = await chatJSON<{
      proposals: Array<{
        taskId: string;
        newDueDate: string;
        reason: string;
      }>;
    }>(
      [
        {
          role: "system",
          content:
            `你是任务排期助手。今天是 ${today}。用户有一些任务需要重新安排截止日期。` +
            "根据优先级、当前逾期情况、子任务进度，为每个任务建议一个合理的新截止日期（YYYY-MM-DD）。" +
            "高优先级 → 近 1-3 天；中优先级 → 3-7 天；低优先级 → 7-14 天。" +
            "reason 一句话说明为什么这样排（不超过 25 字）。" +
            "只返回需要改期的任务（新日期和旧日期不同），不需要改的就别返回。" +
            "taskId 必须从提供的列表里选，newDueDate 必须是 YYYY-MM-DD 格式且不早于今天。" +
            '返回 JSON：{"proposals":[{"taskId":"...","newDueDate":"...","reason":"..."}]}。',
        },
        {
          role: "user",
          content: `需要重排的任务：\n${JSON.stringify(compact, null, 2)}`,
        },
      ],
      { temperature: 0.4 },
    );

    // Validate proposals
    const validIds = new Set(tasks.map((t) => t.id));
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    const proposals = (result.proposals ?? [])
      .filter(
        (p) =>
          p &&
          validIds.has(p.taskId) &&
          typeof p.newDueDate === "string" &&
          dateRe.test(p.newDueDate) &&
          p.newDueDate >= today,
      )
      .map((p) => {
        const task = tasks.find((t) => t.id === p.taskId)!;
        return {
          taskId: p.taskId,
          title: task.title,
          oldDueDate: task.dueDate,
          newDueDate: p.newDueDate,
          reason: p.reason,
          priority: task.priority,
        };
      });

    return NextResponse.json({ proposals });
  } catch (err) {
    const { status, body: errBody } = aiErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
