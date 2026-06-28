import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkDb } from "@/lib/db";

const VALID_COLORS = ["default", "yellow", "green", "blue", "pink", "purple"];

interface MemoInput {
  title?: string;
  content?: string;
  pinned?: boolean;
  color?: string;
}

// GET /api/memos — list all memos (pinned first, then by updatedAt desc)
export async function GET() {
  const dbCheck = await checkDb();
  if (!dbCheck.ok) {
    return NextResponse.json(
      { error: "数据库连接失败", detail: dbCheck.error, hint: dbCheck.hint },
      { status: 503 },
    );
  }
  const memos = await db.memo.findMany({
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json({ memos });
}

// POST /api/memos — create a new memo
export async function POST(req: NextRequest) {
  let body: MemoInput = {};
  try {
    body = (await req.json()) as MemoInput;
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }
  const color = body.color && VALID_COLORS.includes(body.color) ? body.color : "default";
  const created = await db.memo.create({
    data: {
      title: (body.title ?? "").trim(),
      content: (body.content ?? "").trim(),
      pinned: body.pinned ?? false,
      color,
    },
  });
  return NextResponse.json({ memo: created }, { status: 201 });
}
