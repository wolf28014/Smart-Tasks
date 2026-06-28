"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  ListTodo,
  Trello,
  LayoutDashboard,
  CalendarDays,
  Sparkles,
  Trash,
  Database,
  Network,
  GanttChartSquare,
  StickyNote,
  MoreHorizontal,
  Hash,
  FileText,
  Settings,
  Copy,
  CalendarClock,
} from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";

import { ListView } from "@/components/todolist/list-view";
import { KanbanView } from "@/components/todolist/kanban-view";
import { DashboardView } from "@/components/todolist/dashboard-view";
import { CalendarView } from "@/components/todolist/calendar-view";
import { GanttView } from "@/components/todolist/gantt-view";
import { NotesGraphView } from "@/components/todolist/notes-graph-view";
import { MemoView } from "@/components/todolist/memo-view";
import { AutoSaveIndicator } from "@/components/todolist/auto-save-indicator";
import { TaskDialog } from "@/components/todolist/task-dialog";
import { NoteDialog } from "@/components/todolist/note-dialog";
import { DataDialog } from "@/components/todolist/data-dialog";
import { TrashView } from "@/components/todolist/trash-view";
import { PomodoroOverlay } from "@/components/todolist/pomodoro-overlay";
import { BackgroundSelector } from "@/components/todolist/background-selector";
import { TagManagerDialog } from "@/components/todolist/tag-manager-dialog";
import { TagProvider, useTags } from "@/components/todolist/tag-provider";
import { AIProvider, useAI } from "@/components/todolist/ai-provider";
import { AiQuickCreate } from "@/components/todolist/ai-quick-create";
import { AiVoiceButton } from "@/components/todolist/ai-voice-button";
import { AiDailyFocus } from "@/components/todolist/ai-daily-focus";
import { AiWeeklyReport } from "@/components/todolist/ai-weekly-report";
import { AiChatDrawer } from "@/components/todolist/ai-chat-drawer";
import { SettingsDialog } from "@/components/todolist/settings-dialog";
import { AiRetrospectCard } from "@/components/todolist/ai-retrospect-card";
import { AiInsights } from "@/components/todolist/ai-insights";
import { AiDuplicatesDialog } from "@/components/todolist/ai-duplicates-dialog";
import { AiRescheduleDialog } from "@/components/todolist/ai-reschedule-dialog";

import {
  buildIndex,
  canTransition,
  search,
  tokenize,
  type Status,
  type TaskData,
  type TaskInput,
} from "@/lib/task-utils";
import { useTasksBackup } from "@/lib/tasks-backup";

type ViewKey =
  | "list"
  | "kanban"
  | "dashboard"
  | "calendar"
  | "gantt"
  | "graph"
  | "memo"
  | "trash";

const VIEWS: {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: "list", label: "列表", icon: ListTodo },
  { key: "kanban", label: "看板", icon: Trello },
  { key: "gantt", label: "甘特图", icon: GanttChartSquare },
  { key: "calendar", label: "日历", icon: CalendarDays },
  { key: "dashboard", label: "仪表盘", icon: LayoutDashboard },
  { key: "graph", label: "图谱", icon: Network },
  { key: "memo", label: "备忘录", icon: StickyNote },
  { key: "trash", label: "回收站", icon: Trash },
];

export default function Home() {
  return (
    <TagProvider>
      <AIProvider>
        <HomeInner />
      </AIProvider>
    </TagProvider>
  );
}

function HomeInner() {
  const tagCtx = useTags();
  const ai = useAI();
  const [view, setView] = useState<ViewKey>("list");
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loading, setLoading] = useState(true);

  // List view filters
  const [search1, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sort, setSort] = useState("created");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskData | null>(null);

  // Note dialog
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteTask, setNoteTask] = useState<TaskData | null>(null);

  // Data dialog
  const [dataOpen, setDataOpen] = useState(false);

  // Tag manager dialog
  const [tagOpen, setTagOpen] = useState(false);

  // AI weekly report dialog
  const [reportOpen, setReportOpen] = useState(false);

  // AI settings dialog
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ⑥ AI duplicates dialog
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  // ⑦ AI reschedule dialog
  const [rescheduleOpen, setRescheduleOpen] = useState(false);

  // AI chat drawer (E1) — global, no task context
  const [aiChatOpen, setAiChatOpen] = useState(false);
  // AI chat drawer (E2) — task-scoped
  const [aiChatTask, setAiChatTask] = useState<TaskData | null>(null);

  // Voice transcription result (E3) — fed into A2 quick create
  const [voiceText, setVoiceText] = useState<string | undefined>(undefined);

  // ② AI retrospect card — shown when a task is marked done
  const [retrospectTask, setRetrospectTask] = useState<TaskData | null>(null);

  // ③ Semantic search — when AI enabled, defaults to ON (from settings)
  const [semanticSearch, setSemanticSearch] = useState<boolean | null>(null);
  const [semanticResults, setSemanticResults] = useState<
    Map<string, number> | null
  >(null);

  // Load semantic search preference from AI settings
  React.useEffect(() => {
    if (ai.enabled && semanticSearch === null) {
      fetch("/api/ai/settings", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setSemanticSearch(d.semanticSearch !== false))
        .catch(() => setSemanticSearch(false));
    } else if (!ai.enabled) {
      setSemanticSearch(null);
      setSemanticResults(null);
    }
  }, [ai.enabled, semanticSearch]);

  // Run semantic search when query changes (debounced)
  React.useEffect(() => {
    if (!ai.enabled || !semanticSearch || !search1.trim()) {
      setSemanticResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/ai/semantic-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: search1, limit: 20 }),
        });
        if (res.ok) {
          const data = await res.json();
          const m = new Map<string, number>();
          for (const r of data.results ?? []) {
            m.set(r.task.id, r.score);
          }
          setSemanticResults(m);
        }
      } catch {
        // silent fail
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [search1, ai.enabled, semanticSearch]);

  // ③ Backfill embeddings for all tasks on first load (if AI enabled)
  const backfillRef = React.useRef(false);
  React.useEffect(() => {
    if (ai.enabled && !backfillRef.current && tasks.length > 0) {
      backfillRef.current = true;
      fetch("/api/ai/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      }).catch(() => {});
    }
  }, [ai.enabled, tasks.length]);

  // Pomodoro overlay
  const [pomodoroTask, setPomodoroTask] = useState<TaskData | null>(null);

  // Trash view refresh signal
  const [trashRefresh, setTrashRefresh] = useState(0);

  // Delete confirmation (soft delete)
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Auto-save status tracking
  const [lastMutationAt, setLastMutationAt] = useState(0);
  const [online, setOnline] = useState(true);

  React.useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Bump lastMutationAt whenever tasks change (after initial load)
  const isInitialLoad = React.useRef(true);
  React.useEffect(() => {
    if (isInitialLoad.current) {
      if (tasks.length > 0 || !loading) {
        isInitialLoad.current = false;
      }
      return;
    }
    setLastMutationAt(Date.now());
  }, [tasks, loading]);

  // Auto-save tasks to localStorage as backup (every 30s + on change + beforeunload)
  useTasksBackup(tasks);

  // Suggested tags: aggregate from all active tasks, sorted by frequency desc
  const suggestedTags = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      for (const tag of t.tags) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .slice(0, 15);
  }, [tasks]);

  // Tag name → number of tasks using it. Used by TagManagerDialog to show
  // usage counts and detect "orphan" tag names (used by tasks but missing
  // from the Tag table).
  const tagCountByTag = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of tasks) {
      for (const tag of t.tags) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
    return counts;
  }, [tasks]);

  // Total tag count for the header badge
  const totalTagCount = tagCtx.tags.length;

  // --- Data loading --------------------------------------------------------

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const hint =
          err.hint ||
          "请确认已运行 `bun run db:push` 初始化数据库。可访问 /api/health 查看诊断信息。";
        toast({
          title: "加载失败",
          description: hint,
          variant: "destructive",
        });
        setTasks([]);
        return;
      }
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } catch (err) {
      console.error(err);
      toast({
        title: "网络错误",
        description: "无法连接到服务器，请检查 dev server 是否在运行。",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await fetch("/api/tasks/seed", { method: "POST" });
      } catch {
        // ignore
      }
      await reload();
    })();
  }, [reload]);

  // --- TF-IDF search (client-side) -----------------------------------------

  const searchResults = useMemo(() => {
    const q = search1.trim();
    if (!q) return null;
    const index = buildIndex(tasks, (t) =>
      [t.title, t.description, ...t.tags].join(" "),
    );
    return search(index, tasks, q);
  }, [tasks, search1]);

  const highlightTerms = useMemo(
    () => (search1.trim() ? tokenize(search1) : []),
    [search1],
  );

  // --- Client-side filtering for list view ---------------------------------

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (statusFilter !== "all") {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (priorityFilter !== "all") {
      list = list.filter((t) => t.priority === priorityFilter);
    }

    // ③ Semantic search takes priority over TF-IDF when enabled
    if (semanticResults && semanticResults.size > 0) {
      list = list
        .filter((t) => semanticResults.has(t.id))
        .sort(
          (a, b) =>
            (semanticResults.get(b.id) ?? 0) -
            (semanticResults.get(a.id) ?? 0),
        );
    } else if (searchResults) {
      list = searchResults.map((r) => r.task);
    }

    const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const statusRank: Record<string, number> = {
      in_progress: 0,
      todo: 1,
      done: 2,
      cancelled: 3,
    };
    const sorted = [...list];
    if (semanticResults && semanticResults.size > 0) {
      // keep semantic relevance order
    } else if (searchResults) {
      // keep TF-IDF relevance order
    } else if (sort === "due") {
      sorted.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    } else if (sort === "priority") {
      sorted.sort(
        (a, b) =>
          (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9) ||
          (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9),
      );
    } else {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return sorted;
  }, [tasks, statusFilter, priorityFilter, search1, sort, searchResults, semanticResults]);

  // --- Mutations -----------------------------------------------------------

  async function handleSaveTask(input: TaskInput, id?: string) {
    try {
      if (id) {
        const res = await fetch(`/api/tasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "保存失败");
        }
        const { task } = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === id ? task : t)));
        toast({ title: "已更新", description: task.title });
      } else {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "创建失败");
        }
        const { task } = await res.json();
        setTasks((prev) => [task, ...prev]);
        toast({ title: "已创建", description: task.title });
        // ③ Async: generate embedding for the new task (fire and forget)
        if (ai.enabled) {
          fetch("/api/ai/embed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId: task.id }),
          }).catch(() => {});
        }
      }
    } catch (err) {
      toast({
        title: "操作失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
      throw err;
    }
  }

  async function handleToggleDone(task: TaskData) {
    const nextStatus: Status = task.status === "done" ? "todo" : "done";
    if (!canTransition(task.status, nextStatus)) {
      toast({
        title: "无法切换状态",
        description: `${task.status} → ${nextStatus} 不是允许的状态流转`,
        variant: "destructive",
      });
      return;
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              status: nextStatus,
              completedAt:
                nextStatus === "done" ? new Date().toISOString() : null,
            }
          : t,
      ),
    );
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "切换失败");
      }
      const { task: updated } = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      // ② Trigger AI retrospect when task is marked done
      if (nextStatus === "done" && ai.enabled) {
        setRetrospectTask(updated);
      }
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
      toast({
        title: "切换失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    }
  }

  async function handleStatusChange(taskId: string, status: Status) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (!canTransition(task.status, status)) {
      toast({
        title: "无法切换状态",
        description: `${task.status} → ${status} 不是允许的状态流转`,
        variant: "destructive",
      });
      return;
    }
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status,
              completedAt:
                status === "done" ? new Date().toISOString() : null,
            }
          : t,
      ),
    );
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "切换失败");
      }
      const { task: updated } = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? task : t)));
      toast({
        title: "切换失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    }
  }

  async function handleToggleSubtask(taskId: string, subtaskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const nextSubtasks = task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, done: !s.done } : s,
    );
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, subtasks: nextSubtasks } : t,
      ),
    );
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subtasks: nextSubtasks }),
      });
      if (!res.ok) throw new Error("保存失败");
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? task : t)));
      toast({
        title: "保存失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    }
  }

  // Soft delete (move to trash)
  async function handleDelete(id: string) {
    const task = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setDeleteId(null);
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      toast({
        title: "已移入回收站",
        description: task?.title ?? "",
      });
    } catch (err) {
      if (task) setTasks((prev) => [task, ...prev]);
      toast({
        title: "删除失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    }
  }

  // Pomodoro completion: increment pomodoros
  async function handlePomodoroComplete(taskId: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const next = task.pomodoros + 1;
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, pomodoros: next } : t)),
    );
    // Also update the pomodoro overlay task reference
    setPomodoroTask((prev) =>
      prev && prev.id === taskId ? { ...prev, pomodoros: next } : prev,
    );
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pomodoros: next }),
      });
      if (!res.ok) throw new Error("保存番茄钟失败");
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, pomodoros: task.pomodoros } : t)),
      );
      toast({
        title: "番茄钟保存失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    }
  }

  // Note save
  async function handleSaveNote(markdown: string | null) {
    if (!noteTask) return;
    const taskId = noteTask.id;
    const prev = noteTask.noteMarkdown;
    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.id === taskId ? { ...t, noteMarkdown: markdown } : t,
      ),
    );
    setNoteTask((prev) =>
      prev && prev.id === taskId ? { ...prev, noteMarkdown: markdown } : prev,
    );
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteMarkdown: markdown }),
      });
      if (!res.ok) throw new Error("保存笔记失败");
      toast({
        title: markdown ? "笔记已保存" : "笔记已清除",
      });
    } catch (err) {
      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === taskId ? { ...t, noteMarkdown: prev } : t,
        ),
      );
      toast({
        title: "保存失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    }
  }

  // ② Save AI retrospect to the task's notes (append, not replace)
  async function handleSaveRetrospect(taskId: string, retrospect: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const existing = task.noteMarkdown ?? "";
    const updated = existing
      ? `${existing}\n\n${retrospect}`
      : retrospect;
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, noteMarkdown: updated } : t,
      ),
    );
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteMarkdown: updated }),
      });
      if (!res.ok) throw new Error("保存复盘失败");
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, noteMarkdown: existing } : t,
        ),
      );
      toast({
        title: "保存复盘失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    }
  }

  // ⑥ Merge duplicate tasks (keep first, soft-delete rest)
  async function handleMergeDuplicates(
    keepId: string,
    deleteIds: string[],
  ) {
    for (const id of deleteIds) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      try {
        await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      } catch {
        // revert on failure
        const task = tasks.find((t) => t.id === id);
        if (task) setTasks((prev) => [task, ...prev]);
        throw new Error(`删除任务 ${id} 失败`);
      }
    }
  }

  // ⑦ Apply reschedule proposals
  async function handleApplyReschedule(
    proposals: Array<{ taskId: string; newDueDate: string }>,
  ) {
    for (const p of proposals) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === p.taskId ? { ...t, dueDate: p.newDueDate } : t,
        ),
      );
      try {
        const res = await fetch(`/api/tasks/${p.taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dueDate: p.newDueDate }),
        });
        if (!res.ok) throw new Error("更新截止日期失败");
      } catch (err) {
        throw err;
      }
    }
    reload();
  }

  // --- Render --------------------------------------------------------------

  function openNew() {
    setEditingTask(null);
    setDialogOpen(true);
  }

  function openEdit(task: TaskData) {
    setEditingTask(task);
    setDialogOpen(true);
  }

  function openNote(task: TaskData) {
    setNoteTask(task);
    setNoteOpen(true);
  }

  function openPomodoro(task: TaskData) {
    setPomodoroTask(task);
  }

  const pendingCount = tasks.filter(
    (t) => t.status === "todo" || t.status === "in_progress",
  ).length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50/40 via-background to-amber-50/30 dark:from-emerald-950/10 dark:via-background dark:to-amber-950/10">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 flex items-center gap-3">
          {/* Left: logo + stats */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="leading-tight min-w-0">
              <h1 className="text-base font-semibold truncate">智能待办</h1>
              <p className="text-xs text-muted-foreground truncate">
                {pendingCount} 进行中 · {doneCount} 已完成 · {totalTagCount} 标签
              </p>
            </div>
          </div>

          {/* Right: primary actions (always visible) + secondary (in "more" menu) */}
          <div className="ml-auto flex items-center gap-1.5">
            {/* Auto-save status: compact on mobile, hidden on very small screens */}
            <div className="hidden sm:block">
              <AutoSaveIndicator
                lastMutationAt={lastMutationAt}
                online={online}
              />
            </div>

            {/* Appearance: background + theme, grouped together */}
            <BackgroundSelector />
            <ThemeToggle />

            {/* Primary: new task */}
            <Button onClick={openNew} size="sm" className="shadow-sm">
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">新建任务</span>
              <span className="sm:hidden">新建</span>
            </Button>

            {/* Secondary: tag manager, data, autosave-on-mobile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9" aria-label="更多">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>管理</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setTagOpen(true)}>
                  <Hash className="h-4 w-4 mr-2" />
                  标签管理
                  {totalTagCount > 0 && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {totalTagCount}
                    </span>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDataOpen(true)}>
                  <Database className="h-4 w-4 mr-2" />
                  导入 / 导出数据
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  AI 设置
                  <span
                    className={cn(
                      "ml-auto h-1.5 w-1.5 rounded-full",
                      ai.enabled
                        ? "bg-emerald-500"
                        : "bg-muted-foreground/40",
                    )}
                    title={
                      ai.enabled ? "AI 已启用" : "AI 未启用（点击配置）"
                    }
                  />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="sm:hidden px-2 py-1.5">
                  <AutoSaveIndicator
                    lastMutationAt={lastMutationAt}
                    online={online}
                  />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* AI quick create row — A2 (text input) + E3 (voice button)
            Only shown when AI is enabled. */}
        {ai.enabled && (
          <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <AiQuickCreate
                  existingTags={suggestedTags}
                  onCreate={handleSaveTask}
                  prefilledText={voiceText}
                  onPrefilledConsumed={() => setVoiceText(undefined)}
                />
              </div>
              <AiVoiceButton onTranscript={(text) => setVoiceText(text)} />
            </div>
          </div>
        )}

        {/* View tabs */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-3">
          <nav className="flex items-center gap-1 rounded-lg bg-muted/60 p-1 w-fit max-w-full overflow-x-auto">
            {VIEWS.map((v) => {
              const Icon = v.icon;
              const active = view === v.key;
              return (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="viewTab"
                      className="absolute inset-0 bg-background rounded-md shadow-sm"
                      transition={{ type: "spring", duration: 0.4, bounce: 0.15 }}
                    />
                  )}
                  <Icon className="relative h-4 w-4" />
                  <span className="relative">{v.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-6">
        {view === "list" && (
          <ListView
            tasks={filteredTasks}
            loading={loading}
            search={search1}
            onSearch={setSearch}
            statusFilter={statusFilter}
            onStatusFilter={setStatusFilter}
            priorityFilter={priorityFilter}
            onPriorityFilter={setPriorityFilter}
            sort={sort}
            onSort={setSort}
            onEdit={openEdit}
            onToggleDone={handleToggleDone}
            onDelete={(id) => setDeleteId(id)}
            onToggleSubtask={handleToggleSubtask}
            onStartPomodoro={openPomodoro}
            onOpenNote={openNote}
            onAskAI={
              ai.enabled ? (task) => setAiChatTask(task) : undefined
            }
            highlightTerms={search1.trim() ? highlightTerms : undefined}
            onNew={openNew}
            semanticSearch={!!semanticSearch}
            onToggleSemanticSearch={
              ai.enabled
                ? (v) => {
                    setSemanticSearch(v);
                    // Persist to settings
                    fetch("/api/ai/settings", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ semanticSearch: v }),
                    }).catch(() => {});
                  }
                : undefined
            }
          />
        )}
        {view === "kanban" && (
          <KanbanView
            tasks={tasks}
            onStatusChange={handleStatusChange}
            onEdit={openEdit}
            onToggleDone={handleToggleDone}
            onDelete={(id) => setDeleteId(id)}
            onToggleSubtask={handleToggleSubtask}
            onStartPomodoro={openPomodoro}
            onOpenNote={openNote}
            onAskAI={
              ai.enabled ? (task) => setAiChatTask(task) : undefined
            }
            onNew={openNew}
          />
        )}
        {view === "dashboard" && (
          <>
            {ai.enabled && <AiDailyFocus tasks={tasks} onEdit={openEdit} />}
            {ai.enabled && (
              <div className="flex justify-end mb-4 gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDuplicatesOpen(true)}
                >
                  <Copy className="h-4 w-4 mr-1.5" />
                  扫描重复任务
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRescheduleOpen(true)}
                >
                  <CalendarClock className="h-4 w-4 mr-1.5" />
                  AI 智能重排
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReportOpen(true)}
                >
                  <FileText className="h-4 w-4 mr-1.5" />
                  生成 AI 周报
                </Button>
              </div>
            )}
            {ai.enabled && <AiInsights taskCount={tasks.length} />}
            <DashboardView tasks={tasks} />
          </>
        )}
        {view === "calendar" && (
          <CalendarView tasks={tasks} onEdit={openEdit} />
        )}
        {view === "gantt" && (
          <GanttView tasks={tasks} onEdit={openEdit} />
        )}
        {view === "graph" && (
          <NotesGraphView tasks={tasks} onOpenNote={openNote} />
        )}
        {view === "memo" && <MemoView />}
        {view === "trash" && (
          <TrashView
            refreshSignal={trashRefresh}
            onChanged={() => {
              setTrashRefresh((x) => x + 1);
              reload();
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-background/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
          <span>
            参考{" "}
            <a
              href="https://github.com/tate233/todolist"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              tate233/todolist
            </a>{" "}
            · Next.js 16 + Prisma + shadcn/ui
          </span>
          <span>
            支持 8 种视图（列表/看板/甘特图/日历/仪表盘/图谱/备忘录/回收站）、番茄钟历史、Markdown 笔记双向关联、子任务默认展开、自动保存、自定义背景
          </span>
        </div>
      </footer>

      {/* Floating AI assistant button (E1) — only when AI enabled */}
      {ai.enabled && (
        <button
          onClick={() => setAiChatOpen(true)}
          className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center group"
          aria-label="AI 助手"
          title="AI 助手"
        >
          <Sparkles className="h-5 w-5" />
          <span className="absolute right-full mr-3 px-2 py-1 rounded-md bg-foreground text-background text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            AI 助手
          </span>
        </button>
      )}

      {/* Task dialog */}
      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        task={editingTask}
        onSave={handleSaveTask}
        suggestedTags={suggestedTags}
      />

      {/* Note dialog */}
      <NoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        taskTitle={noteTask?.title ?? ""}
        note={noteTask?.noteMarkdown ?? null}
        onSave={handleSaveNote}
        allTaskTitles={tasks.map((t) => t.title)}
        currentTaskId={noteTask?.id}
        aiEnabled={ai.enabled}
      />

      {/* Data import/export dialog */}
      <DataDialog
        open={dataOpen}
        onOpenChange={setDataOpen}
        onChanged={reload}
      />

      {/* Tag manager dialog */}
      <TagManagerDialog
        open={tagOpen}
        onOpenChange={setTagOpen}
        taskCountByTag={tagCountByTag}
      />

      {/* AI weekly report dialog (D1) */}
      <AiWeeklyReport open={reportOpen} onOpenChange={setReportOpen} />

      {/* AI settings dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* ⑥ AI duplicates dialog */}
      <AiDuplicatesDialog
        open={duplicatesOpen}
        onOpenChange={setDuplicatesOpen}
        onMerge={handleMergeDuplicates}
      />

      {/* ⑦ AI reschedule dialog */}
      <AiRescheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        onApply={handleApplyReschedule}
      />

      {/* ② AI retrospect card — shown when task marked done */}
      {retrospectTask && ai.enabled && (
        <AiRetrospectCard
          task={retrospectTask}
          onClose={() => setRetrospectTask(null)}
          onSaveToNotes={handleSaveRetrospect}
        />
      )}

      {/* AI chat drawer — E1 (global) or E2 (task-scoped) */}
      <AiChatDrawer
        open={aiChatOpen || !!aiChatTask}
        onOpenChange={(o) => {
          if (!o) {
            setAiChatOpen(false);
            setAiChatTask(null);
          }
        }}
        contextTask={aiChatTask}
        onActionExecuted={reload}
      />

      {/* Pomodoro overlay */}
      <PomodoroOverlay
        task={pomodoroTask}
        onClose={() => setPomodoroTask(null)}
        onComplete={handlePomodoroComplete}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除任务？</AlertDialogTitle>
            <AlertDialogDescription>
              任务会移动到回收站，30 天内可在回收站恢复；超过 30 天将自动永久删除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Trash className="h-4 w-4 mr-1" />
              移入回收站
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
