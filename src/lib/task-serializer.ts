// Serialization helpers between Prisma Task rows and the TaskData shape
// expected by the frontend.
import { db } from "@/lib/db";
import type { Task } from "@prisma/client";
import type {
  Priority,
  Recurrence,
  Status,
  Subtask,
  TaskData,
  TaskInput,
} from "@/lib/task-utils";
import { PRIORITIES, RECURRENCES, STATUSES } from "@/lib/task-utils";

function asPriority(v: string): Priority {
  return (PRIORITIES as readonly string[]).includes(v)
    ? (v as Priority)
    : "medium";
}
function asStatus(v: string): Status {
  return (STATUSES as readonly string[]).includes(v) ? (v as Status) : "todo";
}
function asRecurrence(v: string | null): Recurrence | null {
  if (!v) return null;
  return (RECURRENCES as readonly string[]).includes(v)
    ? (v as Recurrence)
    : null;
}

export function rowToTask(row: Task): TaskData {
  let tags: string[] = [];
  let subtasks: Subtask[] = [];
  let dependsOn: string[] = [];
  try {
    tags = JSON.parse(row.tags || "[]");
  } catch {
    tags = [];
  }
  try {
    subtasks = JSON.parse(row.subtasks || "[]");
  } catch {
    subtasks = [];
  }
  try {
    dependsOn = JSON.parse(row.dependsOn || "[]");
  } catch {
    dependsOn = [];
  }
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate,
    priority: asPriority(row.priority),
    status: asStatus(row.status),
    recurrence: asRecurrence(row.recurrence),
    tags,
    subtasks,
    dependsOn,
    pomodoros: row.pomodoros,
    noteMarkdown: row.noteMarkdown,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

export function inputToCreateData(input: TaskInput) {
  return {
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    dueDate: input.dueDate ?? null,
    priority: input.priority ?? "medium",
    status: input.status ?? "todo",
    recurrence: input.recurrence ?? null,
    tags: JSON.stringify(input.tags ?? []),
    subtasks: JSON.stringify(input.subtasks ?? []),
    dependsOn: JSON.stringify(input.dependsOn ?? []),
    pomodoros: input.pomodoros ?? 0,
    noteMarkdown: input.noteMarkdown ?? null,
  };
}

export { db };
