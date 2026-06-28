import { NextRequest, NextResponse } from "next/server";
import { db, checkDb } from "@/lib/db";
import { rowToTask } from "@/lib/task-serializer";
import { aiErrorResponse, embed, cosineSimilarity } from "@/lib/ai-client";
import type { TaskData } from "@/lib/task-utils";

// POST /api/ai/semantic-search
// Body: { query: string, limit?: number }
// Returns: { results: Array<{ task: TaskData, score: number }> }
//
// Converts the query to an embedding, then compares against all stored
// task embeddings using cosine similarity. Returns top N matches.

export async function POST(req: NextRequest) {
  const dbCheck = await checkDb();
  if (!dbCheck.ok) {
    return NextResponse.json(
      { error: "数据库连接失败", hint: dbCheck.hint },
      { status: 503 },
    );
  }

  let body: { query?: string; limit?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const query = (body.query ?? "").trim();
  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const limit = Math.min(body.limit ?? 10, 20);

  try {
    // Generate query embedding
    const queryVector = await embed(query);
    if (queryVector.length === 0) {
      return NextResponse.json({ results: [], error: "无法生成查询向量" });
    }

    // Load all embeddings + tasks
    const [embeddingRows, taskRows] = await Promise.all([
      db.taskEmbedding.findMany(),
      db.task.findMany(),
    ]);

    const taskMap = new Map(taskRows.map((r) => [r.id, rowToTask(r)]));

    // Compute similarity scores
    const scored: { task: TaskData; score: number }[] = [];
    for (const embRow of embeddingRows) {
      const task = taskMap.get(embRow.taskId);
      if (!task || task.deletedAt !== null) continue;

      let vector: number[];
      try {
        vector = JSON.parse(embRow.embedding);
      } catch {
        continue;
      }
      const score = cosineSimilarity(queryVector, vector);
      scored.push({ task, score });
    }

    // Sort by score desc, take top N
    scored.sort((a, b) => b.score - a.score);
    const results = scored
      .filter((s) => s.score > 0.3) // minimum threshold
      .slice(0, limit);

    return NextResponse.json({ results });
  } catch (err) {
    const { status, body: errBody } = aiErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
