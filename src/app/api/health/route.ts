import { NextResponse } from "next/server";
import { db, checkDb } from "@/lib/db";
import { existsSync } from "fs";
import path from "path";

// GET /api/health — quick diagnostic for DB connectivity
export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "(default: file:./db/custom.db)";
  const dbCheck = await checkDb();

  // Try to detect common issues
  const possibleDbPaths = [
    "prisma/db/custom.db",
    "db/custom.db",
    "custom.db",
  ];
  const dbFileStatus = possibleDbPaths.map((p) => ({
    path: p,
    exists: existsSync(path.join(process.cwd(), p)),
  }));

  return NextResponse.json({
    ok: dbCheck.ok,
    time: new Date().toISOString(),
    database: {
      url: dbUrl,
      connected: dbCheck.ok,
      error: dbCheck.ok ? null : dbCheck.error,
      hint: dbCheck.ok ? null : dbCheck.hint,
      cwd: process.cwd(),
      possibleFiles: dbFileStatus,
    },
    nextRuntime: {
      nodeEnv: process.env.NODE_ENV,
      hasPrismaClient: !!db,
    },
  });
}
