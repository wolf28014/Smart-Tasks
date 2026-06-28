import { NextRequest, NextResponse } from "next/server";
import { db, checkDb } from "@/lib/db";
import {
  normalizeTagName,
  TAG_COLORS,
  type TagColor,
} from "@/lib/tag-utils";

// GET /api/tags — list all tags sorted by createdAt asc
export async function GET() {
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

  const rows = await db.tag.findMany({
    orderBy: { createdAt: "asc" },
  });

  const tags = rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color as TagColor,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return NextResponse.json({ tags });
}

// POST /api/tags — create a new tag
// Body: { name: string, color?: TagColor }
export async function POST(req: NextRequest) {
  const dbCheck = await checkDb();
  if (!dbCheck.ok) {
    return NextResponse.json(
      { error: "数据库连接失败", hint: dbCheck.hint },
      { status: 503 },
    );
  }

  let body: { name?: string; color?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const name = normalizeTagName(body.name ?? "");
  if (!name) {
    return NextResponse.json({ error: "标签名不能为空" }, { status: 400 });
  }

  const color: TagColor =
    body.color && (TAG_COLORS as readonly string[]).includes(body.color)
      ? (body.color as TagColor)
      : "emerald";

  // Check name uniqueness explicitly so we can return a friendly error
  // (Prisma's unique constraint would otherwise produce a generic 500).
  const existing = await db.tag.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json(
      { error: "标签名已存在" },
      { status: 409 },
    );
  }

  const created = await db.tag.create({ data: { name, color } });
  return NextResponse.json(
    {
      tag: {
        id: created.id,
        name: created.name,
        color: created.color as TagColor,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
