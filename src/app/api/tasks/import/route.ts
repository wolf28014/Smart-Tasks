import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { inputToCreateData, rowToTask } from "@/lib/task-serializer";
import type { Priority, Status, Subtask, TaskInput } from "@/lib/task-utils";
import { PRIORITIES, RECURRENCES, STATUSES } from "@/lib/task-utils";

// POST /api/tasks/import
//
// Accepts a JSON body in the same shape as /api/tasks/export:
//   { tasks: TaskInput[] }   OR   TaskInput[]
// Existing task IDs are updated; new IDs (or missing IDs) are created.
// Returns counts of created / updated / failed items.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  let list: any[];
  if (Array.isArray(body)) {
    list = body;
  } else if (
    body &&
    typeof body === "object" &&
    Array.isArray((body as any).tasks)
  ) {
    list = (body as any).tasks;
  } else {
    return NextResponse.json(
      { error: "数据格式不正确，期望 { tasks: [...] } 或任务数组" },
      { status: 400 },
    );
  }

  const created: string[] = [];
  const updated: string[] = [];
  const failed: { index: number; error: string }[] = [];

  for (let i = 0; i < list.length; i++) {
    const item = list[i] as Partial<TaskInput> & { id?: string };
    try {
      const title = (item.title ?? "").trim();
      if (!title) {
        throw new Error("标题为空");
      }
      // sanitize enums
      const priority: Priority = (PRIORITIES as readonly string[]).includes(
        item.priority ?? "",
      )
        ? (item.priority as Priority)
        : "medium";
      const status: Status = (STATUSES as readonly string[]).includes(
        item.status ?? "",
      )
        ? (item.status as Status)
        : "todo";
      const recurrence =
        item.recurrence &&
        (RECURRENCES as readonly string[]).includes(item.recurrence)
          ? item.recurrence
          : null;

      const input: TaskInput = {
        title,
        description: item.description ?? "",
        dueDate: item.dueDate ?? null,
        priority,
        status,
        recurrence: recurrence as any,
        tags: Array.isArray(item.tags) ? item.tags : [],
        subtasks: Array.isArray(item.subtasks)
          ? item.subtasks.filter(
              (s): s is Subtask =>
                !!s && typeof s.title === "string" && typeof s.done === "boolean",
            )
          : [],
        dependsOn: Array.isArray(item.dependsOn) ? item.dependsOn : [],
        pomodoros:
          typeof item.pomodoros === "number" ? item.pomodoros : 0,
        noteMarkdown: item.noteMarkdown ?? null,
      };

      if (item.id) {
        const existing = await db.task.findUnique({ where: { id: item.id } });
        if (existing) {
          await db.task.update({
            where: { id: item.id },
            data: inputToCreateData(input),
          });
          updated.push(item.id);
          continue;
        }
      }
      // create with given id if provided (so exports round-trip)
      const created2 = await db.task.create({
        data: { ...inputToCreateData(input), ...(item.id ? { id: item.id } : {}) },
      });
      created.push(created2.id);
    } catch (err) {
      failed.push({
        index: i,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    created: created.length,
    updated: updated.length,
    failed: failed.length,
    failures: failed,
  });
}
