import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rowToTask } from "@/lib/task-serializer";

type Params = { params: Promise<{ id: string }> };

// POST /api/tasks/[id]/restore — restore a soft-deleted task
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await db.task.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }
  if (!existing.deletedAt) {
    return NextResponse.json({ error: "任务未被删除" }, { status: 400 });
  }
  const updated = await db.task.update({
    where: { id },
    data: { deletedAt: null },
  });
  return NextResponse.json({ task: rowToTask(updated) });
}
