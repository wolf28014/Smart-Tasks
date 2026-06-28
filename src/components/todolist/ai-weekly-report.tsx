"use client";

import { useState } from "react";
import { Sparkles, Loader2, FileText, Copy, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

interface AiWeeklyReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiWeeklyReport({ open, onOpenChange }: AiWeeklyReportProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    setMarkdown(null);
    try {
      const res = await fetch("/api/ai/weekly-report", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "周报生成失败");
      }
      const data = await res.json();
      setMarkdown(data.markdown);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }

  // Auto-generate when dialog opens
  React.useEffect(() => {
    if (open && !markdown && !loading && !error) {
      generate();
    }
     
  }, [open]);

  async function copyToClipboard() {
    if (!markdown) return;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      toast({ title: "已复制到剪贴板" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "复制失败",
        description: "请手动选中内容复制",
        variant: "destructive",
      });
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      // Reset state when closing so next open regenerates
      setMarkdown(null);
      setError(null);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[680px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            AI 周报
          </DialogTitle>
          <DialogDescription>
            基于本周任务数据自动生成的 Markdown 周报，可复制使用。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {loading && (
            <div className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
              <div className="text-sm">AI 正在生成周报...</div>
            </div>
          )}

          {error && !loading && (
            <div className="py-8 text-center space-y-3">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <div className="text-sm text-rose-600 dark:text-rose-400">
                {error}
              </div>
              <Button size="sm" variant="outline" onClick={generate}>
                <Loader2 className="h-3.5 w-3.5 mr-1" />
                重试
              </Button>
            </div>
          )}

          {markdown && !loading && !error && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-base prose-h2:mt-4 prose-h2:mb-2 prose-p:my-1.5 prose-li:my-0">
                <ReactMarkdown>{markdown}</ReactMarkdown>
              </article>
            </div>
          )}
        </div>

        {markdown && !loading && (
          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={() => handleClose(false)}>
              <X className="h-3.5 w-3.5 mr-1" />
              关闭
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={generate}>
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                重新生成
              </Button>
              <Button size="sm" onClick={copyToClipboard}>
                {copied ? (
                  <Check className="h-3.5 w-3.5 mr-1" />
                ) : (
                  <Copy className="h-3.5 w-3.5 mr-1" />
                )}
                {copied ? "已复制" : "复制全文"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

import React from "react";
