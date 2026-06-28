import { NextRequest, NextResponse } from "next/server";
import { db, checkDb } from "@/lib/db";
import {
  normalizeTagName,
  TAG_COLORS,
  type TagColor,
} from "@/lib/tag-utils";

// PATCH /api/tags/[id] — update name and/or color
// Body: { name?: string, color?: TagColor }
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const dbCheck = await checkDb();
  if (!dbCheck.ok) {
    return NextResponse.json(
      { error: "数据库连接失败", hint: dbCheck.hint },
      { status: 503 },
    );
  }

  const { id } = await params;
  let body: { name?: string; color?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const data: { name?: string; color?: string } = {};
  if (body.name !== undefined) {
    const name = normalizeTagName(body.name);
    if (!name) {
      return NextResponse.json({ error: "标签名不能为空" }, { status: 400 });
    }
    data.name = name;
  }
  if (body.color !== undefined) {
    if (!(TAG_COLORS as readonly string[]).includes(body.color)) {
      return NextResponse.json({ error: "无效的颜色" }, { status: 400 });
    }
    data.color = body.color;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "没有可更新的字段" }, { status: 400 });
  }

  // If renaming, check name uniqueness explicitly.
  if (data.name) {
    const existing = await db.tag.findUnique({ where: { name: data.name } });
    if (existing && existing.id !== id) {
      return NextResponse.json(
        { error: "标签名已存在" },
        { status: 409 },
      );
    }
  }

  try {
    const updated = await db.tag.update({ where: { id }, data });
    return NextResponse.json({
      tag: {
        id: updated.id,
        name: updated.name,
        color: updated.color as TagColor,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch {
    return NextResponse.json({ error: "标签不存在或更新失败" }, { status: 404 });
  }
}

// DELETE /api/tags/[id] — delete a tag
// Note: tasks that reference this tag by name are NOT modified; their
// tag string array keeps the name. The Tag table is purely metadata
// (color etc.), so deleting a tag just removes the color binding.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const dbCheck = await checkDb();
  if (!dbCheck.ok) {
    return NextResponse.json(
      { error: "数据库连接失败", hint: dbCheck.hint },
      { status: 503 },
    );
  }

  const { id } = await params;
  try {
    await db.tag.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "标签不存在" }, { status: 404 });
  }
}
