"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2, RefreshCw, Target, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  PRIORITY_META,
  formatDueLabel,
  isOverdue,
  type TaskData,
} from "@/lib/task-utils";

interface AiDailyFocusProps {
  tasks: TaskData[];
  onEdit: (task: TaskData) => void;
}

interface Pick {
  taskId: string;
  reason: string;
}

interface Response {
  picks: Pick[];
  summary: string;
}

export function AiDailyFocus({ tasks, onEdit }: AiDailyFocusProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Response | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/daily-focus", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "AI 推荐失败");
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load on mount if there are active tasks
  useEffect(() => {
    const active = tasks.filter(
      (t) => t.status === "todo" || t.status === "in_progress",
    );
    if (active.length > 0 && !data && !loading && !error) {
      load();
    }
     
  }, [tasks]);

  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const picks = data?.picks ?? [];
  const hasActive = tasks.some(
    (t) => t.status === "todo" || t.status === "in_progress",
  );

  if (!hasActive) {
    return null; // Don't show the section when there's nothing to focus on
  }

  return (
    <Card className="p-4 mb-6 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/60 to-teal-50/40 dark:from-emerald-950/20 dark:to-teal-950/20">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0 shadow-sm">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-emerald-600" />
              今日重点 · AI 推荐
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={load}
              disabled={loading}
              aria-label="重新生成"
              title="重新生成推荐"
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
          </div>

          {loading && !data && (
            <div className="text-xs text-muted-foreground py-2 flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              AI 正在分析你的任务...
            </div>
          )}

          {error && (
            <div className="text-xs text-rose-600 dark:text-rose-400 py-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {error}
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 ml-1 text-xs"
                onClick={load}
              >
                重试
              </Button>
            </div>
          )}

          {data && !loading && !error && (
            <>
              {data.summary && (
                <p className="text-xs text-muted-foreground mb-2.5">
                  {data.summary}
                </p>
              )}
              {picks.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">
                  暂无推荐任务
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {picks.map((pick, i) => {
                    const task = taskMap.get(pick.taskId);
                    if (!task) return null;
                    const overdue = isOverdue(task.dueDate, task.status);
                    const priority = PRIORITY_META[task.priority];
                    return (
                      <li key={pick.taskId}>
                        <button
                          onClick={() => onEdit(task)}
                          className="w-full text-left rounded-lg border border-border/60 bg-background/70 hover:bg-background hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors p-2.5 group"
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/40 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                                {task.title}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                <span
                                  className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded font-medium",
                                    priority.bg,
                                    priority.color,
                                  )}
                                >
                                  {priority.label}
                                </span>
                                {task.dueDate && (
                                  <span
                                    className={cn(
                                      "text-[10px] px-1.5 py-0.5 rounded",
                                      overdue
                                        ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                                        : "bg-muted text-muted-foreground",
                                    )}
                                  >
                                    {formatDueLabel(task.dueDate)}
                                    {overdue && " · 逾期"}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-1 flex items-start gap-1">
                                <span className="text-emerald-500">→</span>
                                <span>{pick.reason}</span>
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
