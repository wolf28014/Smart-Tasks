import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rowToTask } from "@/lib/task-serializer";

// GET /api/tasks/export?format=json|csv
//
// Exports all active tasks (not soft-deleted) in the requested format.
// JSON is the canonical round-trip format that /api/tasks/import understands.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const format = (searchParams.get("format") ?? "json").toLowerCase();
  const includeDeleted = searchParams.get("includeDeleted") === "1";

  const where = includeDeleted ? {} : { deletedAt: null };
  const rows = await db.task.findMany({ where, orderBy: { createdAt: "asc" } });
  const tasks = rows.map(rowToTask);

  if (format === "csv") {
    const csv = tasksToCsv(tasks);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="todolist-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    });
  }

  // default json
  const json = JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      count: tasks.length,
      tasks,
    },
    null,
    2,
  );
  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="todolist-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
    },
  });
}

function tasksToCsv(tasks: ReturnType<typeof rowToTask>[]): string {
  const headers = [
    "id",
    "title",
    "description",
    "dueDate",
    "priority",
    "status",
    "recurrence",
    "tags",
    "subtasks",
    "dependsOn",
    "pomodoros",
    "noteMarkdown",
    "createdAt",
    "completedAt",
  ];
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? "" : String(v);
    if (s.includes(",") || s.includes("\n") || s.includes('"')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.join(",")];
  for (const t of tasks) {
    lines.push(
      [
        t.id,
        t.title,
        t.description,
        t.dueDate,
        t.priority,
        t.status,
        t.recurrence,
        JSON.stringify(t.tags),
        JSON.stringify(t.subtasks),
        JSON.stringify(t.dependsOn),
        t.pomodoros,
        t.noteMarkdown,
        t.createdAt,
        t.completedAt,
      ]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\n");
}
