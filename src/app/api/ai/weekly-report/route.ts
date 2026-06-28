import { NextResponse } from "next/server";
import { db, checkDb } from "@/lib/db";
import { rowToTask } from "@/lib/task-serializer";
import { aiErrorResponse, chatJSON } from "@/lib/ai-client";

// GET /api/ai/weekly-report
// Returns: { markdown: string }
//
// Generates a Markdown weekly report covering:
//   - completed tasks this week (with counts by tag/priority)
//   - in-progress / overdue tasks
//   - next week's upcoming due tasks
//   - 1-2 sentence AI insight at the end

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

  // Define "this week" as the last 7 days (rolling, simpler than Mon-Sun)
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoISO = weekAgo.toISOString();
  const todayISO = now.toISOString().slice(0, 10);
  const nextWeekISO = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const completedThisWeek = allTasks.filter(
    (t) => t.status === "done" && t.completedAt && t.completedAt >= weekAgoISO,
  );
  const createdThisWeek = allTasks.filter((t) => t.createdAt >= weekAgoISO);
  const inProgress = allTasks.filter(
    (t) => t.status === "todo" || t.status === "in_progress",
  );
  const overdue = inProgress.filter(
    (t) => t.dueDate && t.dueDate < todayISO,
  );
  const upcomingDue = inProgress.filter(
    (t) => t.dueDate && t.dueDate >= todayISO && t.dueDate <= nextWeekISO,
  );

  // Tag frequency among completed this week
  const tagCounts: Record<string, number> = {};
  for (const t of completedThisWeek) {
    for (const tag of t.tags) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
  }

  const summary = {
    range: `${weekAgo.toISOString().slice(0, 10)} ~ ${todayISO}`,
    totals: {
      completed: completedThisWeek.length,
      created: createdThisWeek.length,
      inProgress: inProgress.length,
      overdue: overdue.length,
      upcomingDue: upcomingDue.length,
    },
    completedTasks: completedThisWeek.map((t) => ({
      title: t.title,
      priority: t.priority,
      tags: t.tags,
      pomodoros: t.pomodoros,
      completedAt: t.completedAt?.slice(0, 10),
    })),
    overdueTasks: overdue.map((t) => ({
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate,
      tags: t.tags,
    })),
    upcomingTasks: upcomingDue.map((t) => ({
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate,
      tags: t.tags,
    })),
    topTags: Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag, count]) => ({ tag, count })),
  };

  try {
    const result = await chatJSON<{ markdown: string }>(
      [
        {
          role: "system",
          content:
            "你是周报撰写助手。根据用户本周的任务数据，生成一份 Markdown 格式的周报。" +
            "结构：\n" +
            "## 本周完成（X 项）\n列出 3-5 个重要完成任务，带标签\n" +
            "## 进行中与逾期\n列出关键进行中和逾期任务，逾期任务标注 ⚠️\n" +
            "## 下周重点\n列出下周到期的任务\n" +
            "## 数据小结\n本周完成 X 项 · 新建 Y 项 · 逾期 Z 项 · 热门标签：...\n" +
            "## AI 洞察\n1-2 句话总结本周表现并给出下周建议\n" +
            "语气专业简洁，不要过度赞美。markdown 字段放完整周报内容（含标题）。" +
            '返回 JSON：{"markdown":"..."}。不要返回任何额外文字。',
        },
        {
          role: "user",
          content: `本周任务数据：\n${JSON.stringify(summary, null, 2)}`,
        },
      ],
      { temperature: 0.6 },
    );

    const markdown =
      typeof result.markdown === "string" && result.markdown.trim()
        ? result.markdown.trim()
        : "# 本周周报\n\n（生成失败，请重试）";

    return NextResponse.json({ markdown });
  } catch (err) {
    const { status, body: errBody } = aiErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
