import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/pomodoro/sessions?days=14  — list recent sessions for charting
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("days") ?? "14");
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const rows = await db.pomodoroSession.findMany({
    where: { endedAt: { gte: since } },
    orderBy: { endedAt: "asc" },
  });

  // Aggregate per day
  const byDay: Record<string, { count: number; minutes: number }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    byDay[key] = { count: 0, minutes: 0 };
  }
  for (const r of rows) {
    const key = r.endedAt.toISOString().slice(0, 10);
    if (!byDay[key]) byDay[key] = { count: 0, minutes: 0 };
    byDay[key].count += 1;
    byDay[key].minutes += Math.round(r.duration / 60);
  }
  const series = Object.entries(byDay).map(([date, v]) => ({
    date,
    label: `${new Date(date + "T00:00:00").getMonth() + 1}/${new Date(date + "T00:00:00").getDate()}`,
    count: v.count,
    minutes: v.minutes,
  }));

  const total = rows.length;
  const totalMinutes = rows.reduce(
    (sum, r) => sum + Math.round(r.duration / 60),
    0,
  );

  return NextResponse.json({ series, total, totalMinutes, days });
}

// POST /api/pomodoro/sessions — record a completed pomodoro
export async function POST(req: NextRequest) {
  let body: { taskId?: string; duration?: number } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }
  if (!body.taskId) {
    return NextResponse.json({ error: "缺少 taskId" }, { status: 400 });
  }
  const task = await db.task.findUnique({ where: { id: body.taskId } });
  if (!task) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }
  const duration = body.duration && body.duration > 0 ? body.duration : 1500;
  const session = await db.pomodoroSession.create({
    data: { taskId: body.taskId, duration },
  });
  // Also bump the task's pomodoros counter
  await db.task.update({
    where: { id: body.taskId },
    data: { pomodoros: { increment: 1 } },
  });
  return NextResponse.json({ session }, { status: 201 });
}
