"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  RotateCcw,
  Trash2,
  Trash,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  PRIORITY_META,
  STATUS_META,
  type TaskData,
} from "@/lib/task-utils";

interface TrashViewProps {
  refreshSignal: number;
  onChanged: () => void;
}

export function TrashView({ refreshSignal, onChanged }: TrashViewProps) {
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(true);
  const [emptyOpen, setEmptyOpen] = useState(false);
  const [purgeId, setPurgeId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/tasks/trash")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setTasks(data.tasks ?? []);
      })
      .catch(() => {
        if (!cancelled) setTasks([]);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  async function restore(id: string) {
    try {
      const res = await fetch(`/api/tasks/${id}/restore`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "恢复失败");
      }
      setTasks((prev) => prev.filter((t) => t.id !== id));
      toast({ title: "已恢复", description: "任务已移回主列表" });
      onChanged();
    } catch (err) {
      toast({
        title: "恢复失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    }
  }

  async function purge(id: string) {
    setPurgeId(null);
    const task = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      const res = await fetch(`/api/tasks/${id}?permanent=1`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
      toast({ title: "已永久删除", description: task?.title ?? "" });
      onChanged();
    } catch (err) {
      if (task) setTasks((prev) => [task, ...prev]);
      toast({
        title: "删除失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    }
  }

  async function emptyTrash() {
    setEmptyOpen(false);
    const count = tasks.length;
    setTasks([]);
    try {
      const res = await fetch("/api/tasks/trash", { method: "DELETE" });
      if (!res.ok) throw new Error("清空失败");
      toast({
        title: "回收站已清空",
        description: `已永久删除 ${count} 个任务`,
      });
      onChanged();
    } catch (err) {
      toast({
        title: "清空失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-muted-foreground">加载中...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Trash className="h-5 w-5 text-rose-500" />
            回收站
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            已删除的任务会保留在这里，超过 30 天未恢复将自动永久删除。
          </p>
        </div>
        {tasks.length > 0 && (
          <Button
            variant="outline"
            onClick={() => setEmptyOpen(true)}
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            清空回收站
          </Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed bg-muted/20">
          <div className="mb-4 rounded-full bg-muted p-4">
            <Trash className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">回收站是空的</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            删除的任务会暂存在这里，便于随时恢复。
          </p>
        </div>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="rounded-xl border bg-card p-4 shadow-sm opacity-90"
              >
                <h3 className="font-medium line-through text-muted-foreground truncate">
                  {task.title}
                </h3>
                {task.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {task.description}
                  </p>
                )}
                <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[11px]">
                    {STATUS_META[task.status].label}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[11px]",
                      PRIORITY_META[task.priority].color,
                    )}
                  >
                    {PRIORITY_META[task.priority].label}优先级
                  </Badge>
                  {task.deletedAt && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-rose-500">
                      <Clock className="h-3 w-3" />
                      删除于 {formatDeletedAt(task.deletedAt)}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => restore(task.id)}
                    className="h-8"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    恢复
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPurgeId(task.id)}
                    className="h-8 text-rose-600 hover:text-rose-700"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    永久删除
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Empty trash confirmation */}
      <AlertDialog open={emptyOpen} onOpenChange={setEmptyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空回收站？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将永久删除回收站中的 {tasks.length} 个任务，无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={emptyTrash}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              <AlertTriangle className="h-4 w-4 mr-1" />
              永久清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Per-item purge confirmation */}
      <AlertDialog
        open={!!purgeId}
        onOpenChange={(o) => !o && setPurgeId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>永久删除这个任务？</AlertDialogTitle>
            <AlertDialogDescription>
              操作不可撤销，任务数据将被彻底清除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => purgeId && purge(purgeId)}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              永久删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function formatDeletedAt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}
