import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rowToTask } from "@/lib/task-serializer";
import { canTransition, type Status } from "@/lib/task-utils";
import type { TaskInput } from "@/lib/task-utils";

type Params = { params: Promise<{ id: string }> };

// GET /api/tasks/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const row = await db.task.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }
  return NextResponse.json({ task: rowToTask(row) });
}

// PATCH /api/tasks/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await db.task.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  let body: Partial<TaskInput> = {};
  try {
    body = (await req.json()) as Partial<TaskInput>;
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  // Validate status state machine
  if (body.status && body.status !== existing.status) {
    if (!canTransition(existing.status as Status, body.status)) {
      return NextResponse.json(
        {
          error: `非法状态流转: ${existing.status} → ${body.status}`,
        },
        { status: 400 },
      );
    }
  }

  // Validate dependency satisfaction when marking done
  if (body.status === "done" && existing.status !== "done") {
    let dependsOn: string[] = [];
    try {
      dependsOn = JSON.parse(existing.dependsOn || "[]");
    } catch {
      dependsOn = [];
    }
    if (dependsOn.length > 0) {
      const prereqs = await db.task.findMany({
        where: { id: { in: dependsOn } },
        select: { id: true, status: true, title: true },
      });
      const blocked = prereqs.filter((p) => p.status !== "done");
      if (blocked.length > 0) {
        return NextResponse.json(
          {
            error: `前置任务尚未完成: ${blocked.map((b) => b.title).join(", ")}`,
          },
          { status: 400 },
        );
      }
    }
  }

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.description !== undefined) data.description = body.description.trim();
  if (body.dueDate !== undefined) data.dueDate = body.dueDate;
  if (body.priority !== undefined) data.priority = body.priority;
  if (body.status !== undefined) {
    data.status = body.status;
    if (body.status === "done" && !existing.completedAt) {
      data.completedAt = new Date();
    }
    if (body.status !== "done") {
      data.completedAt = null;
    }
  }
  if (body.recurrence !== undefined) data.recurrence = body.recurrence;
  if (body.tags !== undefined) data.tags = JSON.stringify(body.tags);
  if (body.subtasks !== undefined) data.subtasks = JSON.stringify(body.subtasks);
  if (body.dependsOn !== undefined) data.dependsOn = JSON.stringify(body.dependsOn);
  if (body.pomodoros !== undefined) data.pomodoros = body.pomodoros;
  if (body.noteMarkdown !== undefined) data.noteMarkdown = body.noteMarkdown;

  const updated = await db.task.update({ where: { id }, data });
  return NextResponse.json({ task: rowToTask(updated) });
}

// DELETE /api/tasks/[id]?permanent=1  -> hard delete
// DELETE /api/tasks/[id]              -> soft delete (move to trash)
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const permanent = searchParams.get("permanent") === "1";

  const existing = await db.task.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  if (permanent) {
    await db.task.delete({ where: { id } });
  } else {
    await db.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true, permanent });
}
