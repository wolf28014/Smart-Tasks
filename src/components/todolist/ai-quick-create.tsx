"use client";

import { useState } from "react";
import { Sparkles, Loader2, CornerDownLeft, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  PRIORITIES,
  PRIORITY_META,
  type Priority,
  type TaskInput,
} from "@/lib/task-utils";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";

interface AiQuickCreateProps {
  /** Existing tag names, used to help the parser pick matching tags. */
  existingTags: string[];
  /** Called when the user confirms the parsed task. */
  onCreate: (input: TaskInput) => Promise<void>;
  /** Optional: prefilled text from voice transcription (E3). */
  prefilledText?: string;
  onPrefilledConsumed?: () => void;
}

interface ParsedTask {
  title: string;
  description?: string;
  dueDate?: string | null;
  priority?: Priority;
  tags?: string[];
}

export function AiQuickCreate({
  existingTags,
  onCreate,
  prefilledText,
  onPrefilledConsumed,
}: AiQuickCreateProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedTask | null>(null);

  // When voice transcription arrives, fill the input and auto-parse.
  React.useEffect(() => {
    if (prefilledText) {
      setText(prefilledText);
      onPrefilledConsumed?.();
      // Auto-trigger parse
      void parseAndPreview(prefilledText);
    }
     
  }, [prefilledText]);

  async function parseAndPreview(raw?: string) {
    const input = (raw ?? text).trim();
    if (!input) return;
    setLoading(true);
    setParsed(null);
    try {
      const res = await fetch("/api/ai/parse-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input, existingTags }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "AI 解析失败");
      }
      const data = await res.json();
      setParsed(data.task);
    } catch (err) {
      toast({
        title: "AI 解析失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (parsed) {
        confirmCreate();
      } else if (!loading && text.trim()) {
        parseAndPreview();
      }
    }
  }

  async function confirmCreate() {
    if (!parsed) return;
    try {
      await onCreate({
        title: parsed.title,
        description: parsed.description,
        dueDate: parsed.dueDate ?? null,
        priority: parsed.priority ?? "medium",
        tags: parsed.tags ?? [],
      });
      // Reset on success
      setText("");
      setParsed(null);
    } catch {
      // toast handled by parent
    }
  }

  function reset() {
    setText("");
    setParsed(null);
  }

  return (
    <div className="w-full">
      <div className="relative">
        <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500 shrink-0" />
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (parsed) setParsed(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="用一句话描述任务，AI 自动解析标题/截止/优先级/标签，回车预览..."
          className="pl-9 pr-24 h-10"
          disabled={loading}
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {text && !parsed && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={reset}
              disabled={loading}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            onClick={() => (parsed ? confirmCreate() : parseAndPreview())}
            disabled={loading || !text.trim()}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : parsed ? (
              <CornerDownLeft className="h-3 w-3 mr-1" />
            ) : (
              <Sparkles className="h-3 w-3 mr-1" />
            )}
            {loading ? "解析中" : parsed ? "创建" : "解析"}
          </Button>
        </div>
      </div>

      {/* Parsed preview */}
      {parsed && (
        <div className="mt-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{parsed.title}</div>
              {parsed.description && (
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {parsed.description}
                </div>
              )}
              <div className="flex items-center gap-1.5 flex-wrap mt-2">
                {parsed.priority && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      PRIORITY_META[parsed.priority].bg,
                      PRIORITY_META[parsed.priority].color,
                    )}
                  >
                    {PRIORITY_META[parsed.priority].label}优先级
                  </Badge>
                )}
                {parsed.dueDate && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <CalendarDays className="h-2.5 w-2.5" />
                    {parsed.dueDate}
                  </Badge>
                )}
                {parsed.tags?.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-[10px] border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={() => setParsed(null)}
            >
              修改
            </Button>
          </div>
          <div className="text-[10px] text-muted-foreground mt-2">
            确认无误？按回车或点「创建」按钮直接添加，或点「修改」重新输入。
          </div>
        </div>
      )}
    </div>
  );
}

// React import for useEffect — kept at bottom to avoid top-of-file noise
import React from "react";
