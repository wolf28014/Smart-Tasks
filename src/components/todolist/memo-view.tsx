"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pin,
  PinOff,
  Trash2,
  StickyNote,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Memo {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  color: string;
  createdAt: string;
  updatedAt: string;
}

const COLORS: Record<
  string,
  { bg: string; border: string; dot: string; label: string }
> = {
  default: {
    bg: "bg-card",
    border: "border-border",
    dot: "bg-slate-400",
    label: "默认",
  },
  yellow: {
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    border: "border-yellow-200 dark:border-yellow-800",
    dot: "bg-yellow-400",
    label: "黄",
  },
  green: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-400",
    label: "绿",
  },
  blue: {
    bg: "bg-sky-50 dark:bg-sky-950/30",
    border: "border-sky-200 dark:border-sky-800",
    dot: "bg-sky-400",
    label: "蓝",
  },
  pink: {
    bg: "bg-pink-50 dark:bg-pink-950/30",
    border: "border-pink-200 dark:border-pink-800",
    dot: "bg-pink-400",
    label: "粉",
  },
  purple: {
    bg: "bg-violet-50 dark:bg-violet-950/30",
    border: "border-violet-200 dark:border-violet-800",
    dot: "bg-violet-400",
    label: "紫",
  },
};

export function MemoView() {
  const [memos, setMemos] = React.useState<Memo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");

  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/memos", { cache: "no-store" });
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setMemos(data.memos ?? []);
    } catch (err) {
      toast({
        title: "加载失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    reload();
  }, [reload]);

  async function handleCreate() {
    try {
      const res = await fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "", content: "", color: "yellow" }),
      });
      if (!res.ok) throw new Error("创建失败");
      const { memo } = await res.json();
      setMemos((prev) => [memo, ...prev]);
    } catch (err) {
      toast({
        title: "创建失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    }
  }

  // Auto-save with debounce
  async function saveMemo(id: string, patch: Partial<Memo>) {
    // Optimistic update
    setMemos((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, ...patch, updatedAt: new Date().toISOString() } : m,
      ),
    );
    try {
      const res = await fetch(`/api/memos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("保存失败");
      const { memo } = await res.json();
      setMemos((prev) => prev.map((m) => (m.id === id ? memo : m)));
    } catch (err) {
      toast({
        title: "自动保存失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: string) {
    const memo = memos.find((m) => m.id === id);
    setMemos((prev) => prev.filter((m) => m.id !== id));
    try {
      const res = await fetch(`/api/memos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      toast({ title: "已删除", description: memo?.title || "无标题备忘录" });
    } catch (err) {
      if (memo) setMemos((prev) => [memo, ...prev]);
      toast({
        title: "删除失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    }
  }

  async function togglePin(id: string, pinned: boolean) {
    await saveMemo(id, { pinned: !pinned });
  }

  function changeColor(id: string, color: string) {
    saveMemo(id, { color });
  }

  const filtered = React.useMemo(() => {
    if (!search.trim()) return memos;
    const q = search.toLowerCase();
    return memos.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.content.toLowerCase().includes(q),
    );
  }, [memos, search]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索备忘录..."
            className="pl-9"
          />
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-1" />
          新建备忘录
        </Button>
      </div>

      {/* Hint */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
        <StickyNote className="h-3.5 w-3.5" />
        <span>
          备忘录与任务列表独立，所有修改<span className="font-medium text-emerald-600 dark:text-emerald-400">自动保存</span>
          。置顶的备忘录会显示在最前面。
        </span>
      </div>

      {/* Memo grid */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground">加载中...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed bg-muted/20">
          <div className="mb-4 rounded-full bg-muted p-4">
            <StickyNote className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium">
            {search ? "未找到匹配的备忘录" : "还没有备忘录"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground max-w-sm">
            {search
              ? "试着调整搜索关键词。"
              : "点击右上角「新建备忘录」开始记录你的灵感、想法或临时笔记。"}
          </p>
          {!search && (
            <Button onClick={handleCreate} className="mt-5">
              <Plus className="mr-2 h-4 w-4" />
              新建备忘录
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((memo) => (
              <MemoCard
                key={memo.id}
                memo={memo}
                onSave={saveMemo}
                onDelete={handleDelete}
                onTogglePin={togglePin}
                onChangeColor={changeColor}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function MemoCard({
  memo,
  onSave,
  onDelete,
  onTogglePin,
  onChangeColor,
}: {
  memo: Memo;
  onSave: (id: string, patch: Partial<Memo>) => void;
  onDelete: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onChangeColor: (id: string, color: string) => void;
}) {
  const [title, setTitle] = React.useState(memo.title);
  const [content, setContent] = React.useState(memo.content);
  const [showColors, setShowColors] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<string>("已保存");

  // Sync local state if memo changes externally
  React.useEffect(() => {
    setTitle(memo.title);
    setContent(memo.content);
  }, [memo.id, memo.updatedAt]);

  // Debounced auto-save
  const titleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (titleTimer.current) clearTimeout(titleTimer.current);
    if (title !== memo.title) {
      setSavedAt("保存中...");
      titleTimer.current = setTimeout(() => {
        onSave(memo.id, { title });
        setSavedAt("已保存");
      }, 600);
    }
    return () => {
      if (titleTimer.current) clearTimeout(titleTimer.current);
    };
  }, [title, memo.id, memo.title, onSave]);

  React.useEffect(() => {
    if (contentTimer.current) clearTimeout(contentTimer.current);
    if (content !== memo.content) {
      setSavedAt("保存中...");
      contentTimer.current = setTimeout(() => {
        onSave(memo.id, { content });
        setSavedAt("已保存");
      }, 800);
    }
    return () => {
      if (contentTimer.current) clearTimeout(contentTimer.current);
    };
  }, [content, memo.id, memo.content, onSave]);

  const color = COLORS[memo.color] ?? COLORS.default;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={cn(
        "rounded-xl border shadow-sm flex flex-col overflow-hidden",
        color.bg,
        color.border,
        memo.pinned && "ring-2 ring-amber-300 dark:ring-amber-700",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-current/10">
        <button
          onClick={() => onTogglePin(memo.id, memo.pinned)}
          className={cn(
            "p-1 rounded hover:bg-current/10",
            memo.pinned
              ? "text-amber-500"
              : "text-muted-foreground/50 hover:text-foreground",
          )}
          aria-label={memo.pinned ? "取消置顶" : "置顶"}
          title={memo.pinned ? "取消置顶" : "置顶"}
        >
          {memo.pinned ? (
            <Pin className="h-3.5 w-3.5 fill-current" />
          ) : (
            <PinOff className="h-3.5 w-3.5" />
          )}
        </button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题（可选）"
          className="h-7 border-none bg-transparent focus-visible:ring-0 px-1 text-sm font-medium"
        />
        <button
          onClick={() => setShowColors((v) => !v)}
          className={cn(
            "p-1 rounded hover:bg-current/10 text-muted-foreground/50 hover:text-foreground",
            showColors && "bg-current/10",
          )}
          aria-label="选择颜色"
          title="选择颜色"
        >
          <span className={cn("block h-3.5 w-3.5 rounded-full", color.dot)} />
        </button>
        <button
          onClick={() => onDelete(memo.id)}
          className="p-1 rounded hover:bg-current/10 text-muted-foreground/50 hover:text-rose-500"
          aria-label="删除"
          title="删除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Color picker */}
      {showColors && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-current/10 bg-current/5">
          {Object.entries(COLORS).map(([key, c]) => (
            <button
              key={key}
              onClick={() => {
                onChangeColor(memo.id, key);
                setShowColors(false);
              }}
              className={cn(
                "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110",
                c.dot,
                memo.color === key
                  ? "border-foreground"
                  : "border-transparent",
              )}
              aria-label={c.label}
              title={c.label}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="在这里写下你的想法..."
        className="flex-1 min-h-[120px] resize-none border-none bg-transparent focus-visible:ring-0 text-sm leading-relaxed"
      />

      {/* Footer */}
      <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t border-current/10 flex items-center justify-between">
        <span>{formatUpdatedAt(memo.updatedAt)}</span>
        <span className="flex items-center gap-1">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              savedAt === "保存中..." ? "bg-amber-400 animate-pulse" : "bg-emerald-400",
            )}
          />
          {savedAt}
        </span>
      </div>
    </motion.div>
  );
}

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
