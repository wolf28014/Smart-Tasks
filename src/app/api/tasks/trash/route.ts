import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rowToTask } from "@/lib/task-serializer";

// GET /api/tasks/trash — list soft-deleted tasks
export async function GET() {
  const rows = await db.task.findMany({
    where: { NOT: { deletedAt: null } },
    orderBy: { deletedAt: "desc" },
  });
  return NextResponse.json({ tasks: rows.map(rowToTask) });
}

// DELETE /api/tasks/trash — empty trash (permanent delete all soft-deleted)
export async function DELETE() {
  const result = await db.task.deleteMany({
    where: { NOT: { deletedAt: null } },
  });
  return NextResponse.json({ deleted: result.count });
}

// PATCH /api/tasks/trash?olderThanDays=30 — auto-purge items older than N days
export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Number(searchParams.get("olderThanDays") ?? "30");
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const result = await db.task.deleteMany({
    where: {
      NOT: { deletedAt: null },
      deletedAt: { lt: cutoff },
    },
  });
  return NextResponse.json({ purged: result.count, cutoff: cutoff.toISOString() });
}
