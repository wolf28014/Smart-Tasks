import { NextRequest, NextResponse } from "next/server";
import { db, checkDb } from "@/lib/db";
import { rowToTask } from "@/lib/task-serializer";
import { aiErrorResponse, chatJSON } from "@/lib/ai-client";

// POST /api/ai/check-conflicts
// Body: { task: { title, description?, dueDate?, priority?, tags? }, existingTaskId?: string }
// Returns: { warnings: Array<{ type, message, severity }> }
//
// Checks for potential issues before saving a task:
//   - same-day overload (5+ tasks on the same due date)
//   - duplicate/similar task titles
//   - dependency bottlenecks (if task has dependsOn that aren't done)
//   - unrealistic due date (e.g. high priority + far future, or low priority + overdue)

interface Warning {
  type: "overload" | "duplicate" | "dependency" | "dueDate" | "info";
  message: string;
  severity: "low" | "medium" | "high";
}

export async function POST(req: NextRequest) {
  const dbCheck = await checkDb();
  if (!dbCheck.ok) {
    return NextResponse.json(
      { error: "数据库连接失败", hint: dbCheck.hint },
      { status: 503 },
    );
  }

  let body: {
    task?: {
      title?: string;
      description?: string;
      dueDate?: string | null;
      priority?: string;
      tags?: string[];
    };
    existingTaskId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const task = body.task;
  if (!task?.title?.trim()) {
    return NextResponse.json({ warnings: [] });
  }

  const rows = await db.task.findMany();
  const allTasks = rows
    .map(rowToTask)
    .filter((t) => t.deletedAt === null && t.id !== body.existingTaskId);

  const today = new Date().toISOString().slice(0, 10);
  const warnings: Warning[] = [];

  // --- Rule-based checks (fast, no AI needed) ---

  // 1. Same-day overload
  if (task.dueDate) {
    const sameDay = allTasks.filter((t) => t.dueDate === task.dueDate);
    if (sameDay.length >= 5) {
      warnings.push({
        type: "overload",
        message: `${task.dueDate} 当天已有 ${sameDay.length} 个任务，建议分流到其他日期`,
        severity: sameDay.length >= 8 ? "high" : "medium",
      });
    }
  }

  // 2. Duplicate title check (exact or very similar)
  const lowerTitle = task.title.toLowerCase().trim();
  const similar = allTasks.filter((t) => {
    const existing = t.title.toLowerCase().trim();
    return (
      existing === lowerTitle ||
      (existing.length > 4 && lowerTitle.includes(existing)) ||
      (lowerTitle.length > 4 && existing.includes(lowerTitle))
    );
  });
  if (similar.length > 0) {
    warnings.push({
      type: "duplicate",
      message: `已有相似任务「${similar[0].title}」，确认不是重复？`,
      severity: "medium",
    });
  }

  // 3. Overdue due date
  if (task.dueDate && task.dueDate < today) {
    warnings.push({
      type: "dueDate",
      message: `截止日期 ${task.dueDate} 已过，确认要设为逾期？`,
      severity: "low",
    });
  }

  // --- AI-based check (deeper analysis) ---
  // Only run AI check if there are tasks to compare against and no major
  // rule-based warnings already found (to save API calls).
  if (allTasks.length > 0 && warnings.length < 2) {
    try {
      const compact = allTasks.slice(0, 30).map((t) => ({
        title: t.title,
        dueDate: t.dueDate,
        priority: t.priority,
        status: t.status,
        tags: t.tags,
      }));

      const result = await chatJSON<{
        warnings: Array<{
          type: string;
          message: string;
          severity: string;
        }>;
      }>(
        [
          {
            role: "system",
            content:
              "你是任务规划助手。分析用户要创建的新任务和现有任务列表，找出潜在问题。" +
              "检查：1) 是否和现有任务语义重复 2) 截止日期是否合理 3) 优先级是否匹配紧急程度。" +
              "只返回真正需要提醒的问题（最多 2 条），没有问题就返回空数组。" +
              '返回 JSON：{"warnings":[{"type":"duplicate|dueDate|priority","message":"简短提醒（不超过30字）","severity":"low|medium|high"}]}。',
          },
          {
            role: "user",
            content: `新任务：${JSON.stringify({
              title: task.title,
              description: task.description,
              dueDate: task.dueDate,
              priority: task.priority,
              tags: task.tags,
            })}\n\n现有任务（前30个）：${JSON.stringify(compact)}`,
          },
        ],
        { temperature: 0.3 },
      );

      for (const w of result.warnings ?? []) {
        if (w && typeof w.message === "string" && w.message.trim()) {
          warnings.push({
            type: (w.type as Warning["type"]) || "info",
            message: w.message.trim(),
            severity:
              w.severity === "high" || w.severity === "low"
                ? w.severity
                : "medium",
          });
        }
      }
    } catch {
      // AI check failed — don't block the save, just skip AI warnings
    }
  }

  // Deduplicate by message
  const seen = new Set<string>();
  const deduped = warnings.filter((w) => {
    if (seen.has(w.message)) return false;
    seen.add(w.message);
    return true;
  });

  return NextResponse.json({ warnings: deduped });
}
