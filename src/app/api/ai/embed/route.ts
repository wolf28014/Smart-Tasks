import { NextRequest, NextResponse } from "next/server";
import { db, checkDb } from "@/lib/db";
import { rowToTask } from "@/lib/task-serializer";
import { aiErrorResponse, embed } from "@/lib/ai-client";

// POST /api/ai/embed
// Body: { taskId?: string, all?: boolean }
//   - taskId: regenerate embedding for one task
//   - all: regenerate embeddings for ALL active tasks (bulk backfill)
// Returns: { processed: number, errors: number }

export async function POST(req: NextRequest) {
  const dbCheck = await checkDb();
  if (!dbCheck.ok) {
    return NextResponse.json(
      { error: "数据库连接失败", hint: dbCheck.hint },
      { status: 503 },
    );
  }

  let body: { taskId?: string; all?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  // Determine which tasks to process
  let taskIds: string[] = [];
  if (body.taskId) {
    taskIds = [body.taskId];
  } else if (body.all) {
    const rows = await db.task.findMany();
    taskIds = rows
      .map(rowToTask)
      .filter((t) => t.deletedAt === null)
      .map((t) => t.id);
  } else {
    return NextResponse.json(
      { error: "请指定 taskId 或 all=true" },
      { status: 400 },
    );
  }

  let processed = 0;
  let errors = 0;

  for (const taskId of taskIds) {
    try {
      const taskRow = await db.task.findUnique({ where: { id: taskId } });
      if (!taskRow) {
        errors++;
        continue;
      }
      const task = rowToTask(taskRow);
      // Build the text to embed: title + description + tags
      const text = [task.title, task.description, ...task.tags]
        .filter(Boolean)
        .join(" ");
      if (!text.trim()) {
        continue; // nothing to embed
      }

      const vector = await embed(text);
      if (vector.length === 0) continue;

      // Upsert embedding
      await db.taskEmbedding.upsert({
        where: { taskId },
        create: {
          taskId,
          embedding: JSON.stringify(vector),
        },
        update: {
          embedding: JSON.stringify(vector),
        },
      });
      processed++;
    } catch {
      errors++;
    }
  }

  return NextResponse.json({ processed, errors });
}
