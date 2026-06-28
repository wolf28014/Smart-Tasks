import { NextRequest, NextResponse } from "next/server";
import { db, checkDb } from "@/lib/db";
import { inputToCreateData, rowToTask } from "@/lib/task-serializer";
import {
  buildIndex,
  search,
  type TaskData,
  type TaskInput,
} from "@/lib/task-utils";

// GET /api/tasks — list active tasks with optional filters:
//   ?status=todo,in_progress   ?priority=high   ?tag=work   ?q=keyword
//   ?overdue=1   ?dueToday=1   ?sort=due|priority|created
//   ?includeDeleted=1   (admin only — used by trash UI)
export async function GET(req: NextRequest) {
  // First check DB connectivity and return a structured error if it fails,
  // so the frontend can display a helpful message instead of a generic 500.
  const dbCheck = await checkDb();
  if (!dbCheck.ok) {
    return NextResponse.json(
      {
        error: "数据库连接失败",
        detail: dbCheck.error,
        hint: dbCheck.hint,
      },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  const priorityParam = searchParams.get("priority");
  const tag = searchParams.get("tag");
  const q = searchParams.get("q")?.trim();
  const overdue = searchParams.get("overdue") === "1";
  const dueToday = searchParams.get("dueToday") === "1";
  const sort = searchParams.get("sort") ?? "created";
  const includeDeleted = searchParams.get("includeDeleted") === "1";

  const statuses = statusParam ? statusParam.split(",") : null;
  const priorities = priorityParam ? priorityParam.split(",") : null;

  // Fetch all (small dataset), filter soft-deleted by default.
  const rows = await db.task.findMany();
  let tasks = rows
    .map(rowToTask)
    .filter((t) => includeDeleted || t.deletedAt === null);

  if (statuses) {
    tasks = tasks.filter((t) => statuses.includes(t.status));
  }
  if (priorities) {
    tasks = tasks.filter((t) => priorities.includes(t.priority));
  }
  if (tag) {
    tasks = tasks.filter((t) => t.tags.includes(tag));
  }

  // TF-IDF search when q provided
  let scored: { task: TaskData; score: number }[] | null = null;
  if (q) {
    const index = buildIndex(tasks, (t) =>
      [t.title, t.description, ...t.tags].join(" "),
    );
    const results = search(index, tasks, q);
    scored = results.map((r) => ({ task: r.task, score: r.score }));
    tasks = scored.map((s) => s.task);
  }

  if (overdue) {
    const today = new Date().toISOString().slice(0, 10);
    tasks = tasks.filter(
      (t) =>
        t.dueDate !== null &&
        t.dueDate < today &&
        t.status !== "done" &&
        t.status !== "cancelled",
    );
  }
  if (dueToday) {
    const today = new Date().toISOString().slice(0, 10);
    tasks = tasks.filter((t) => t.dueDate === today);
  }

  // Sort
  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const statusRank: Record<string, number> = {
    in_progress: 0,
    todo: 1,
    done: 2,
    cancelled: 3,
  };
  if (q && scored) {
    // keep TF-IDF relevance order
  } else if (sort === "due") {
    tasks.sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  } else if (sort === "priority") {
    tasks.sort(
      (a, b) =>
        (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9) ||
        (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9),
    );
  } else {
    // created (newest first)
    tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return NextResponse.json({ tasks });
}

// POST /api/tasks — create a new task
export async function POST(req: NextRequest) {
  let body: TaskInput;
  try {
    body = (await req.json()) as TaskInput;
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }
  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: "任务标题不能为空" }, { status: 400 });
  }

  const created = await db.task.create({ data: inputToCreateData(body) });
  return NextResponse.json({ task: rowToTask(created) }, { status: 201 });
}
