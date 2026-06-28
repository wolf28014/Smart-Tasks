"use client";

import { useEffect, useState } from "react";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Insight {
  type: "positive" | "warning" | "tip";
  title: string;
  detail: string;
}

interface Props {
  /** Active task count — only render when > 0 */
  taskCount: number;
}

export function AiInsights({ taskCount }: Props) {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/insights", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "加载失败");
      }
      const data = await res.json();
      setInsights(data.insights ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (taskCount > 0) load();
     
  }, [taskCount]);

  if (taskCount === 0) return null;

  const iconFor = (type: Insight["type"]) => {
    if (type === "positive") return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    if (type === "warning") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <Lightbulb className="h-4 w-4 text-sky-500" />;
  };

  const bgFor = (type: Insight["type"]) => {
    if (type === "positive")
      return "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20";
    if (type === "warning")
      return "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20";
    return "border-sky-200 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/20";
  };

  return (
    <Card className="p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-semibold">AI 数据洞察</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={load}
          disabled={loading}
          aria-label="刷新"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </Button>
      </div>

      {loading && insights.length === 0 && (
        <div className="py-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <Loader2 className="h-3 w-3 animate-spin" />
          AI 正在分析你的任务数据...
        </div>
      )}

      {error && (
        <div className="py-2 text-xs text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      {!loading && !error && insights.length > 0 && (
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-2 rounded-lg border p-2.5",
                bgFor(insight.type),
              )}
            >
              <div className="shrink-0 mt-0.5">{iconFor(insight.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">
                  {insight.title}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {insight.detail}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
