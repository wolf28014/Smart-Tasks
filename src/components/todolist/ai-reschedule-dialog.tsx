"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarClock,
  Loader2,
  Check,
  X,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Proposal {
  taskId: string;
  title: string;
  oldDueDate: string | null;
  newDueDate: string;
  reason: string;
  priority: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with selected proposals to apply. */
  onApply: (
    proposals: Array<{ taskId: string; newDueDate: string }>,
  ) => Promise<void>;
}

export function AiRescheduleDialog({ open, onOpenChange, onApply }: Props) {
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    setProposals([]);
    setSelected(new Set());
    try {
      const res = await fetch("/api/ai/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "overdue" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "生成建议失败");
      }
      const data = await res.json();
      setProposals(data.proposals ?? []);
      // Select all by default
      setSelected(new Set((data.proposals ?? []).map((p: Proposal) => p.taskId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) load();
     
  }, [open]);

  function toggle(taskId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  async function handleApply() {
    const toApply = proposals.filter((p) => selected.has(p.taskId));
    if (toApply.length === 0) return;
    setApplying(true);
    try {
      await onApply(
        toApply.map((p) => ({ taskId: p.taskId, newDueDate: p.newDueDate })),
      );
      toast({
        title: "已应用",
        description: `重排了 ${toApply.length} 个任务的截止日期`,
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "应用失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-emerald-500" />
            AI 智能重排截止日期
          </DialogTitle>
          <DialogDescription>
            AI 根据优先级和当前逾期情况，建议新的截止日期。勾选后一键应用。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading && (
            <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
              <div className="text-sm">AI 正在分析逾期任务...</div>
            </div>
          )}

          {error && !loading && (
            <div className="py-4 text-center text-sm text-rose-600 dark:text-rose-400">
              {error}
              <Button
                size="sm"
                variant="outline"
                className="ml-2 h-7"
                onClick={load}
              >
                重试
              </Button>
            </div>
          )}

          {!loading && !error && proposals.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              ✓ 没有需要重排的逾期任务
            </div>
          )}

          {!loading && !error && proposals.length > 0 && (
            <div className="space-y-2">
              {proposals.map((p) => {
                const isSelected = selected.has(p.taskId);
                return (
                  <label
                    key={p.taskId}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors",
                      isSelected
                        ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                        : "border-border hover:border-foreground/20",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggle(p.taskId)}
                      className="mt-1 accent-emerald-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {p.title}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <span className={p.oldDueDate && p.oldDueDate < new Date().toISOString().slice(0, 10) ? "text-rose-600 dark:text-rose-400 font-medium" : ""}>
                          {p.oldDueDate ?? "无截止"}
                        </span>
                        <ArrowRight className="h-3 w-3" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {p.newDueDate}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {p.reason}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <span className="text-xs text-muted-foreground mr-auto">
            已选 {selected.size} / {proposals.length}
          </span>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={applying}
          >
            取消
          </Button>
          <Button
            onClick={handleApply}
            disabled={applying || selected.size === 0}
          >
            {applying ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-1" />
            )}
            {applying ? "应用中..." : `应用重排 (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
