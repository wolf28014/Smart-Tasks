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
import { Copy, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface DuplicateGroup {
  tasks: Array<{
    id: string;
    title: string;
    dueDate: string | null;
    status: string;
    priority: string;
  }>;
  reason: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when user confirms merging a group (keep first, delete rest) */
  onMerge: (keepId: string, deleteIds: string[]) => Promise<void>;
}

export function AiDuplicatesDialog({ open, onOpenChange, onMerge }: Props) {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mergingIds, setMergingIds] = useState<Set<number>>(new Set());
  const [mergedGroups, setMergedGroups] = useState<Set<number>>(new Set());

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/find-duplicates", {
        cache: "no-store",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "扫描失败");
      }
      const data = await res.json();
      setGroups(data.groups ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      setMergedGroups(new Set());
      load();
    }
     
  }, [open]);

  async function handleMerge(groupIndex: number) {
    const group = groups[groupIndex];
    if (!group || group.tasks.length < 2) return;
    const keepId = group.tasks[0].id;
    const deleteIds = group.tasks.slice(1).map((t) => t.id);
    setMergingIds((prev) => new Set(prev).add(groupIndex));
    try {
      await onMerge(keepId, deleteIds);
      setMergedGroups((prev) => new Set(prev).add(groupIndex));
      toast({
        title: "已合并",
        description: `保留「${group.tasks[0].title}」，删除 ${deleteIds.length} 个重复`,
      });
    } catch (err) {
      toast({
        title: "合并失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setMergingIds((prev) => {
        const next = new Set(prev);
        next.delete(groupIndex);
        return next;
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4 text-emerald-500" />
            AI 重复任务扫描
          </DialogTitle>
          <DialogDescription>
            AI 分析所有任务，找出语义重复的并分组，可选择合并。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading && (
            <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
              <div className="text-sm">AI 正在扫描所有任务...</div>
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

          {!loading && !error && groups.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              ✓ 没有发现重复任务
            </div>
          )}

          {!loading && !error && groups.length > 0 && (
            <div className="space-y-3">
              {groups.map((group, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg border p-3",
                    mergedGroups.has(i)
                      ? "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20"
                      : "border-border",
                  )}
                >
                  <div className="text-xs text-muted-foreground mb-2">
                    {group.reason}
                  </div>
                  <div className="space-y-1.5">
                    {group.tasks.map((task, j) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        {j === 0 ? (
                          <Badge className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            保留
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-rose-600">
                            删除
                          </Badge>
                        )}
                        <span className="flex-1 truncate">{task.title}</span>
                        {task.dueDate && (
                          <span className="text-[11px] text-muted-foreground">
                            {task.dueDate}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {!mergedGroups.has(i) && (
                    <div className="flex gap-1.5 mt-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleMerge(i)}
                        disabled={mergingIds.has(i)}
                      >
                        {mergingIds.has(i) ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3 mr-1" />
                        )}
                        合并（保留第一个）
                      </Button>
                    </div>
                  )}
                  {mergedGroups.has(i) && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      已合并
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>完成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
