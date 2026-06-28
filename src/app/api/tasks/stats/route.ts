import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rowToTask } from "@/lib/task-serializer";

// GET /api/tasks/stats — aggregated statistics for the dashboard
export async function GET() {
  const rows = await db.task.findMany();
  const tasks = rows.map(rowToTask);

  const today = new Date().toISOString().slice(0, 10);

  const byStatus: Record<string, number> = {
    todo: 0,
    in_progress: 0,
    done: 0,
    cancelled: 0,
  };
  const byPriority: Record<string, number> = { low: 0, medium: 0, high: 0 };
  let overdueCount = 0;
  let dueTodayCount = 0;
  let tagCounts: Record<string, number> = {};

  // Last 14 days completion trend
  const trend: { date: string; done: number; created: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    trend.push({ date: key, done: 0, created: 0 });
  }
  const trendIndex = new Map(trend.map((t, i) => [t.date, i]));

  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
    for (const tag of t.tags) {
      tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
    if (
      t.dueDate &&
      t.dueDate < today &&
      t.status !== "done" &&
      t.status !== "cancelled"
    ) {
      overdueCount++;
    }
    if (t.dueDate === today) {
      dueTodayCount++;
    }
    // trend
    const createdDate = t.createdAt.slice(0, 10);
    const ci = trendIndex.get(createdDate);
    if (ci !== undefined) trend[ci].created++;
    if (t.completedAt) {
      const completedDate = t.completedAt.slice(0, 10);
      const di = trendIndex.get(completedDate);
      if (di !== undefined) trend[di].done++;
    }
  }

  // Subtask progress
  let subtaskTotal = 0;
  let subtaskDone = 0;
  for (const t of tasks) {
    subtaskTotal += t.subtasks.length;
    subtaskDone += t.subtasks.filter((s) => s.done).length;
  }

  // Pomodoro total
  const pomodoros = tasks.reduce((sum, t) => sum + t.pomodoros, 0);

  // Top tags
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return NextResponse.json({
    total: tasks.length,
    byStatus,
    byPriority,
    overdueCount,
    dueTodayCount,
    subtaskTotal,
    subtaskDone,
    pomodoros,
    topTags,
    trend,
  });
}
