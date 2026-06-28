import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// POST /api/settings/background
// Accepts multipart/form-data with field "file" (image/png, image/jpeg, image/webp, image/gif).
// Returns { url } — a relative URL to the saved image.
export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "无效的表单数据" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少 file 字段" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "文件为空" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `图片大小不能超过 5MB（当前 ${(file.size / 1024 / 1024).toFixed(2)}MB）`,
      },
      { status: 413 },
    );
  }

  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
  ];
  const mime = (file.type || "").toLowerCase();
  if (!allowedTypes.includes(mime)) {
    return NextResponse.json(
      { error: "仅支持 PNG / JPEG / WebP / GIF 格式" },
      { status: 415 },
    );
  }

  const ext = mime.split("/")[1] || "bin";
  const hash = crypto.randomBytes(8).toString("hex");
  const filename = `bg-${Date.now()}-${hash}.${ext}`;

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  if (!existsSync(uploadDir)) {
    await mkdir(uploadDir, { recursive: true });
  }
  const filePath = path.join(uploadDir, filename);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await writeFile(filePath, buffer);

  return NextResponse.json({
    url: `/uploads/${filename}`,
    size: file.size,
    type: mime,
  });
}
