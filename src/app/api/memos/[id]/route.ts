import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_COLORS = ["default", "yellow", "green", "blue", "pink", "purple"];

type Params = { params: Promise<{ id: string }> };

interface MemoInput {
  title?: string;
  content?: string;
  pinned?: boolean;
  color?: string;
}

// PATCH /api/memos/[id] — update memo (used for auto-save)
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await db.memo.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "备忘录不存在" }, { status: 404 });
  }
  let body: MemoInput = {};
  try {
    body = (await req.json()) as MemoInput;
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title.trim();
  if (body.content !== undefined) data.content = body.content;
  if (body.pinned !== undefined) data.pinned = body.pinned;
  if (body.color !== undefined && VALID_COLORS.includes(body.color)) {
    data.color = body.color;
  }
  const updated = await db.memo.update({ where: { id }, data });
  return NextResponse.json({ memo: updated });
}

// DELETE /api/memos/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await db.memo.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "备忘录不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
