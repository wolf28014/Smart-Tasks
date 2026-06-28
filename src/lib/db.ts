import { PrismaClient } from "@prisma/client";
import path from "node:path";

// Resolve DATABASE_URL with a sensible default for SQLite so the app does not
// crash silently when the user forgets to create .env.
//
// IMPORTANT: Prisma's CLI and the Prisma Client runtime resolve relative
// SQLite URLs against DIFFERENT base directories:
//   - CLI (db:push, migrate): relative to prisma/schema.prisma
//   - Runtime client: relative to process.cwd()
// So `file:./db/custom.db` in schema.prisma creates the DB at
// `prisma/db/custom.db` via the CLI, but the runtime looks for it at
// `./db/custom.db` (i.e. project root). To avoid this mismatch we always
// pass an absolute URL to the PrismaClient constructor.
function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Default absolute path — matches what `prisma db push` creates when
  // schema.prisma uses `url = "file:./db/custom.db"`.
  return `file:${path.join(process.cwd(), "prisma", "db", "custom.db")}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  __dbError?: Error;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: resolveDatabaseUrl() } },
    log: ["error", "warn"],
  });
}

// Surface a friendly error during API calls instead of crashing silently.
export const db =
  globalForPrisma.prisma ??
  createPrismaClient();

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
        (process.env.DATABASE_URL || "(未设置，使用默认 ./db/custom.db)"),
    };
  }
}
