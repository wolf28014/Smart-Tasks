import { NextResponse } from "next/server";
import { db, checkDb } from "@/lib/db";
import { rowToTask } from "@/lib/task-serializer";
import { aiErrorResponse, chatJSON } from "@/lib/ai-client";

// GET /api/ai/insights
// Returns: { insights: Array<{ type, title, detail, icon }> }
//
// Generates 2-4 data-driven insights about the user's task patterns:
//   - completion rate trends (this week vs last week)
//   - tag-specific overdue rates
//   - priority distribution anomalies
//   - best/worst productivity times (from pomodoro sessions if available)

interface Insight {
  type: "positive" | "warning" | "tip";
  title: string;
  detail: string;
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

  if (allTasks.length === 0) {
    return NextResponse.json({
      insights: [
        {
          type: "tip",
          title: "还没有任务",
          detail: "创建几个任务后，这里会显示个性化的数据分析",
        },
      ],
    });
  }

  const now = new Date();
  const todayISO = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Compute statistics
  const active = allTasks.filter(
    (t) => t.status === "todo" || t.status === "in_progress",
  );
  const done = allTasks.filter((t) => t.status === "done");
  const overdue = active.filter(
    (t) => t.dueDate && t.dueDate < todayISO,
  );

  // This week vs last week completion
  const doneThisWeek = done.filter(
    (t) => t.completedAt && new Date(t.completedAt) >= weekAgo,
  );
  const doneLastWeek = done.filter((t) => {
    if (!t.completedAt) return false;
    const d = new Date(t.completedAt);
    return d >= twoWeeksAgo && d < weekAgo;
  });

  // Tag-level overdue rates
  const tagStats: Record<string, { total: number; overdue: number }> = {};
  for (const t of active) {
    for (const tag of t.tags) {
      tagStats[tag] ??= { total: 0, overdue: 0 };
      tagStats[tag].total++;
      if (t.dueDate && t.dueDate < todayISO) tagStats[tag].overdue++;
    }
  }

  // Priority distribution
  const priorityCount = { high: 0, medium: 0, low: 0 };
  for (const t of active) {
    priorityCount[t.priority]++;
  }

  const stats = {
    total: allTasks.length,
    active: active.length,
    done: done.length,
    overdue: overdue.length,
    doneThisWeek: doneThisWeek.length,
    doneLastWeek: doneLastWeek.length,
    topTags: Object.entries(tagStats)
      .sort((a, b) => b[1].overdue - a[1].overdue || b[1].total - a[1].total)
      .slice(0, 5)
      .map(([tag, s]) => ({ tag, ...s })),
    priorityDistribution: priorityCount,
  };

  try {
    const result = await chatJSON<{ insights: Insight[] }>(
      [
        {
          role: "system",
          content:
            "你是任务数据分析助手。基于用户的任务统计数据，生成 2-4 条有价值的洞察。" +
            "洞察类型：positive（做得好的）、warning（需要注意的）、tip（建议）。" +
            "每条洞察：title 不超过 15 字，detail 不超过 50 字，要具体、有数据支撑、有可操作性。" +
            "不要空泛的废话（如「继续保持」）。如果数据不足以分析，坦诚说明。" +
            '返回 JSON：{"insights":[{"type":"positive|warning|tip","title":"...","detail":"..."}]}。',
        },
        {
          role: "user",
          content: `任务统计数据：\n${JSON.stringify(stats, null, 2)}`,
        },
      ],
      { temperature: 0.5 },
    );

    const insights = (result.insights ?? [])
      .filter(
        (i) =>
          i &&
          typeof i.title === "string" &&
          typeof i.detail === "string" &&
          i.title.trim() &&
          i.detail.trim(),
      )
      .slice(0, 4);

    return NextResponse.json({ insights });
  } catch (err) {
    const { status, body: errBody } = aiErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
