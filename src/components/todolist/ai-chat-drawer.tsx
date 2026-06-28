"use client";

import { useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  X,
  Check,
  ShieldCheck,
  AlertCircle,
  User,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { TaskData } from "@/lib/task-utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** If present, this assistant message proposes an action for the user to confirm. */
  proposedAction?: {
    toolName: string;
    args: Record<string, unknown>;
    description: string;
  };
  /** If present, this message shows the result of an executed action. */
  actionResult?: {
    description: string;
    ok: boolean;
  };
}

interface AiChatDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If set, the chat operates in single-task mode (E2). */
  contextTask?: TaskData | null;
  /** Called when an action executes successfully (so the parent can refresh data). */
  onActionExecuted?: () => void;
}

export function AiChatDrawer({
  open,
  onOpenChange,
  contextTask,
  onActionExecuted,
}: AiChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null); // toolName being executed
  const scrollRef = useRef<HTMLDivElement>(null);

  const isTaskMode = !!contextTask;

  // Reset conversation when the drawer opens (or when switching task mode)
  useEffect(() => {
    if (open) {
      setMessages([
        {
          role: "assistant",
          content: isTaskMode
            ? `你好！我现在聚焦在任务「${contextTask!.title}」上。可以问我这个任务的细节，或者让我修改它（修改前会请你确认）。`
            : "你好！我是你的任务助手。可以问我有哪些任务、建议先做哪个，也可以让我创建/修改/删除任务（操作前会请你确认）。",
        },
      ]);
      setInput("");
      setLoading(false);
      setExecuting(null);
    }
     
  }, [open, isTaskMode, contextTask?.id]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages
            .filter((m) => !m.proposedAction && !m.actionResult)
            .map((m) => ({ role: m.role, content: m.content })),
          context: contextTask ? { taskId: contextTask.id } : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "AI 响应失败");
      }
      const data = await res.json();

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.reply || "",
        proposedAction: data.proposedAction ?? undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ ${err instanceof Error ? err.message : "未知错误"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function confirmAction(
    msgIndex: number,
    action: NonNullable<ChatMessage["proposedAction"]>,
  ) {
    setExecuting(action.toolName);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          execute: { toolName: action.toolName, args: action.args },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "执行失败");
      }
      const data = await res.json();

      // Mark the proposed-action message as resolved
      setMessages((prev) =>
        prev.map((m, i) =>
          i === msgIndex
            ? {
                ...m,
                proposedAction: undefined,
                actionResult: { description: action.description, ok: true },
              }
            : m,
        ),
      );

      // Add the follow-up reply
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "操作已完成" },
      ]);

      onActionExecuted?.();
      toast({ title: "操作已执行", description: action.description });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `执行失败：${err instanceof Error ? err.message : "未知错误"}`,
        },
      ]);
      toast({
        title: "执行失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setExecuting(null);
    }
  }

  function rejectAction(msgIndex: number) {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === msgIndex
          ? {
              ...m,
              proposedAction: undefined,
              content: m.content + "\n\n（用户已取消此操作）",
            }
          : m,
      ),
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const title = isTaskMode ? "任务 AI 助手" : "AI 助手";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[440px] p-0 flex flex-col"
      >
        <SheetHeader className="px-4 py-3 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate">{title}</div>
              {isTaskMode && (
                <div className="text-[11px] text-muted-foreground font-normal truncate">
                  聚焦：{contextTask?.title}
                </div>
              )}
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/20"
        >
          {messages.map((msg, i) => (
            <MessageBubble
              key={i}
              msg={msg}
              onConfirm={() => msg.proposedAction && confirmAction(i, msg.proposedAction)}
              onReject={() => rejectAction(i)}
              executing={!!executing}
            />
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pl-9">
              <Loader2 className="h-3 w-3 animate-spin" />
              AI 思考中...
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-3 shrink-0">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息，回车发送..."
              disabled={loading || !!executing}
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={send}
              disabled={loading || !!executing || !input.trim()}
              aria-label="发送"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MessageBubble({
  msg,
  onConfirm,
  onReject,
  executing,
}: {
  msg: ChatMessage;
  onConfirm: () => void;
  onReject: () => void;
  executing: boolean;
}) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
          isUser
            ? "bg-muted text-muted-foreground"
            : "bg-gradient-to-br from-emerald-500 to-teal-600 text-white",
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </div>
      <div className={cn("flex-1 min-w-0", isUser && "flex justify-end")}>
        {msg.content && (
          <div
            className={cn(
              "inline-block rounded-2xl px-3 py-2 text-sm max-w-[85%]",
              isUser
                ? "bg-emerald-600 text-white rounded-tr-sm"
                : "bg-background border rounded-tl-sm",
            )}
          >
            <div className="whitespace-pre-wrap break-words">{msg.content}</div>
          </div>
        )}

        {/* Action result badge */}
        {msg.actionResult && (
          <div
            className={cn(
              "inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full mt-1",
              msg.actionResult.ok
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
            )}
          >
            <Check className="h-3 w-3" />
            已执行：{msg.actionResult.description}
          </div>
        )}

        {/* Proposed action confirmation UI */}
        {msg.proposedAction && (
          <div className="mt-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-2.5 max-w-[85%]">
            <div className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-200 mb-2">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">需要你确认</div>
                <div className="text-amber-700 dark:text-amber-300 mt-0.5">
                  {msg.proposedAction.description}
                </div>
              </div>
            </div>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={onConfirm}
                disabled={executing}
              >
                {executing ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Check className="h-3 w-3 mr-1" />
                )}
                确认执行
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={onReject}
                disabled={executing}
              >
                <X className="h-3 w-3 mr-1" />
                取消
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// E2: smaller inline version for task-level AI (used inside TaskCard popover)
// Currently we use the same Sheet-based drawer with contextTask set,
// so no separate component needed.
export type { ChatMessage };
