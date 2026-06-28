import { NextResponse } from "next/server";
import { db, checkDb } from "@/lib/db";
import { rowToTask } from "@/lib/task-serializer";
import { aiErrorResponse, chatJSON } from "@/lib/ai-client";

// GET /api/ai/find-duplicates
// Returns: { groups: Array<{ tasks: Array<{ id, title, dueDate, status }>, reason: string }> }
//
// Scans all active tasks and groups semantically similar ones together.
// Uses LLM to identify duplicates (not just exact title matches).

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

  if (allTasks.length < 2) {
    return NextResponse.json({ groups: [] });
  }

  // Send compact task list to LLM for duplicate detection
  const compact = allTasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description?.slice(0, 50),
    tags: t.tags,
    status: t.status,
    dueDate: t.dueDate,
  }));

  try {
    const result = await chatJSON<{
      groups: Array<{
        taskIds: string[];
        reason: string;
      }>;
    }>(
      [
        {
          role: "system",
          content:
            "你是任务去重助手。分析任务列表，找出语义重复或高度相似的任务组。" +
            "只返回真正重复的组（至少 2 个任务），不重复就返回空数组。" +
            "reason 一句话说明为什么重复（不超过 25 字）。" +
            "taskIds 必须从提供的任务列表里选。" +
            '返回 JSON：{"groups":[{"taskIds":["id1","id2"],"reason":"..."}]}。',
        },
        {
          role: "user",
          content: `任务列表（共${compact.length}个）：\n${JSON.stringify(compact)}`,
        },
      ],
      { temperature: 0.3 },
    );

    const validIds = new Set(allTasks.map((t) => t.id));
    const groups = (result.groups ?? [])
      .filter(
        (g) =>
          Array.isArray(g.taskIds) &&
          g.taskIds.length >= 2 &&
          g.taskIds.every((id: string) => validIds.has(id)),
      )
      .map((g) => ({
        tasks: g.taskIds.map((id: string) => {
          const t = allTasks.find((x) => x.id === id)!;
          return {
            id: t.id,
            title: t.title,
            dueDate: t.dueDate,
            status: t.status,
            priority: t.priority,
          };
        }),
        reason: g.reason,
      }));

    return NextResponse.json({ groups });
  } catch (err) {
    const { status, body: errBody } = aiErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
