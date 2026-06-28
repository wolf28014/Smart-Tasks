import { PrismaClient } from "@prisma/client";
import path from "node:path";

// Prisma's SQLite relative paths are unreliable in Next.js dev mode
// because the runtime client resolves them against its own working
// directory (.next/dev/server/chunks/...), not the project root.
// We compute an absolute path here and pass it explicitly to the
// PrismaClient constructor so it always points to the right file
// regardless of where the CLI created it.
//
// The .env file ships with `DATABASE_URL="file:./db/custom.db"` which
// the Prisma CLI (db:push) resolves correctly to <project>/db/custom.db.
// Here we resolve the same logical path to an absolute URL for the
// runtime client.

function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl) {
    // If it's already an absolute file: URL, use as-is
    if (envUrl.startsWith("file:/")) return envUrl;
    // If it's a relative file: URL, resolve against cwd
    const match = envUrl.match(/^file:(.+)$/);
    if (match) {
      const relPath = match[1];
      return `file:${path.resolve(process.cwd(), relPath)}`;
    }
    return envUrl;
  }
  // Fallback (shouldn't happen since .env ships with a default)
  return `file:${path.resolve(process.cwd(), "db", "custom.db")}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: resolveDatabaseUrl() } },
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
        (process.env.DATABASE_URL || "(未设置)"),
    };
  }
}
