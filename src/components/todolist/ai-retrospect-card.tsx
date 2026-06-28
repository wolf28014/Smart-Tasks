"use client";

import { useState } from "react";
import { Sparkles, X, Loader2, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { TaskData } from "@/lib/task-utils";

interface AiRetrospectCardProps {
  task: TaskData;
  onClose: () => void;
  /** Called with the retrospect markdown so the parent can save it to notes. */
  onSaveToNotes: (taskId: string, retrospect: string) => Promise<void>;
}

export function AiRetrospectCard({
  task,
  onClose,
  onSaveToNotes,
}: AiRetrospectCardProps) {
  const [loading, setLoading] = useState(true);
  const [retrospect, setRetrospect] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Generate retrospect on mount
  React.useEffect(() => {
    let cancelled = false;
    async function generate() {
      try {
        const res = await fetch("/api/ai/retrospect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: task.id }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "复盘生成失败");
        }
        const data = await res.json();
        if (!cancelled) {
          setRetrospect(data.retrospect);
          setSummary(data.summary);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "未知错误");
          setLoading(false);
        }
      }
    }
    generate();
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  async function handleSaveToNotes() {
    setSaving(true);
    try {
      const markdown = `## AI 复盘\n\n${retrospect}\n\n*(自动生成于 ${new Date().toLocaleString("zh-CN")})*\n`;
      await onSaveToNotes(task.id, markdown);
      setSaved(true);
      toast({ title: "复盘已写入笔记" });
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      toast({
        title: "写入笔记失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-background shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="h-3.5 w-3.5" />
          AI 任务复盘
        </div>
        <button
          onClick={onClose}
          className="text-white/80 hover:text-white"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-3">
        <div className="text-xs text-muted-foreground mb-1.5 truncate">
          ✓ 已完成 · {task.title}
        </div>

        {loading && (
          <div className="py-6 flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
            <div className="text-xs">正在生成复盘...</div>
          </div>
        )}

        {error && !loading && (
          <div className="py-4 text-center">
            <div className="text-xs text-rose-600 dark:text-rose-400 mb-2">
              {error}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              className="h-7 text-xs"
            >
              关闭
            </Button>
          </div>
        )}

        {retrospect && !loading && !error && (
          <>
            {summary && (
              <div className="text-sm font-medium text-foreground mb-2">
                {summary}
              </div>
            )}
            <div className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed mb-3">
              {retrospect}
            </div>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs flex-1"
                onClick={onClose}
                disabled={saving}
              >
                仅查看
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs flex-1"
                onClick={handleSaveToNotes}
                disabled={saving || saved}
              >
                {saved ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    已写入
                  </>
                ) : (
                  <>
                    <FileText className="h-3 w-3 mr-1" />
                    {saving ? "写入中..." : "写入笔记"}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import React from "react";
