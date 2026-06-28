import { PrismaClient } from "@prisma/client";
import path from "node:path";
import fs from "node:fs";

// Prisma's SQLite relative paths are tricky:
//   - Prisma CLI (db:push) reads `file:./db/custom.db` from .env and
//     resolves it RELATIVE TO the schema.prisma directory (prisma/),
//     so the DB file ends up at <project>/prisma/db/custom.db
//   - Prisma Client runtime resolves relative paths against its own
//     working directory (.next/dev/server/chunks/ in dev mode), which
//     is NOT the project root — so it looks in the wrong place.
//
// Fix: in the runtime, we compute the absolute path to where the CLI
// actually created the DB (<project>/prisma/db/custom.db) and pass it
// explicitly to the PrismaClient constructor via `datasources.db.url`.
// This overrides whatever path the CLI baked into the generated client.

function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;

  // If DATABASE_URL is set and uses an absolute path, use it as-is.
  if (envUrl && envUrl.startsWith("file:/")) return envUrl;

  // For relative paths (or when DATABASE_URL is unset), compute the
  // absolute path to <project>/prisma/db/custom.db.
  //
  // Why prisma/db/custom.db and not db/custom.db?
  //   The Prisma CLI resolves `file:./db/custom.db` against the schema
  //   directory, creating the file at prisma/db/custom.db. We mirror
  //   that location here so the runtime client finds the same file.
  const dbFileName = "custom.db";
  const absPath = path.resolve(process.cwd(), "prisma", "db", dbFileName);
  return `file:${absPath}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = resolveDatabaseUrl();
  // Ensure the parent directory exists (Windows fails if it doesn't)
  const dbPath = url.replace(/^file:/, "");
  const dbDir = path.dirname(dbPath);
  try {
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  } catch {
    // Ignore — if we can't create the dir, Prisma will throw a clearer error
  }
  return new PrismaClient({
    datasources: { db: { url } },
    log: ["error", "warn"],
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// Helper for routes to verify DB connectivity and return a structured error.
export async function checkDb() {
  try {
    await db.task.count();
    return { ok: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false as const,
      error: message,
      hint:
        "请确认已运行 `bun run db:push` 初始化数据库，并且 `.env` 文件存在。" +
        "当前 DATABASE_URL=" +
        (process.env.DATABASE_URL || "(未设置)") +
        " · 解析后绝对路径=" +
        resolveDatabaseUrl(),
    };
  }
}
