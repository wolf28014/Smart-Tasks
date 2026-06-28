"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Search,
  ListTodo,
  Inbox,
  LayoutGrid,
  FolderTree,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskCard } from "./task-card";
import { cn } from "@/lib/utils";
import {
  PRIORITIES,
  PRIORITY_META,
  STATUSES,
  STATUS_META,
  type TaskData,
} from "@/lib/task-utils";
import { TAG_COLOR_META, normalizeTagColor } from "@/lib/tag-utils";
import { useTagsOptional } from "@/lib/tag-context";
import { Hash, ChevronDown, ChevronRight } from "lucide-react";

interface ListViewProps {
  tasks: TaskData[];
  loading: boolean;
  search: string;
  onSearch: (v: string) => void;
  statusFilter: string;
  onStatusFilter: (v: string) => void;
  priorityFilter: string;
  onPriorityFilter: (v: string) => void;
  sort: string;
  onSort: (v: string) => void;
  onEdit: (task: TaskData) => void;
  onToggleDone: (task: TaskData) => void;
  onDelete: (id: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onStartPomodoro: (task: TaskData) => void;
  onOpenNote: (task: TaskData) => void;
  highlightTerms?: string[];
  onNew: () => void;
}

export function ListView(props: ListViewProps) {
  const {
    tasks,
    loading,
    search,
    onSearch,
    statusFilter,
    onStatusFilter,
    priorityFilter,
    onPriorityFilter,
    sort,
    onSort,
    onEdit,
    onToggleDone,
    onDelete,
    onToggleSubtask,
    onStartPomodoro,
    onOpenNote,
    highlightTerms,
    onNew,
  } = props;

  const [grouped, setGrouped] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const tagCtx = useTagsOptional();

  const hasFilters =
    !!search || statusFilter !== "all" || priorityFilter !== "all";

  // Group by tag
  const groupedTasks = useMemo(() => {
    if (!grouped) return null;
    const UNGROUPED = "__ungrouped__";
    const map: Record<string, TaskData[]> = {};
    for (const t of tasks) {
      if (t.tags.length === 0) {
        (map[UNGROUPED] ??= []).push(t);
      } else {
        for (const tag of t.tags) {
          (map[tag] ??= []).push(t);
        }
      }
    }
    // Sort groups: registered tags first (by Tag table order), then
    // unregistered by usage desc; "未分组" always last.
    const entries = Object.entries(map);
    const tagOrder = new Map<string, number>();
    if (tagCtx) {
      tagCtx.tags.forEach((t, i) => tagOrder.set(t.name, i));
    }
    entries.sort((a, b) => {
      if (a[0] === UNGROUPED) return 1;
      if (b[0] === UNGROUPED) return -1;
      const ia = tagOrder.get(a[0]);
      const ib = tagOrder.get(b[0]);
      if (ia !== undefined && ib !== undefined) return ia - ib;
      if (ia !== undefined) return -1;
      if (ib !== undefined) return 1;
      return b[1].length - a[1].length;
    });
    return entries;
  }, [tasks, grouped, tagCtx]);

  const renderCard = (task: TaskData) => (
    <TaskCard
      key={task.id}
      task={task}
      onEdit={onEdit}
      onToggleDone={onToggleDone}
      onDelete={onDelete}
      onToggleSubtask={onToggleSubtask}
      onStartPomodoro={onStartPomodoro}
      onOpenNote={onOpenNote}
      highlight={highlightTerms}
    />
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="智能搜索（TF-IDF 全文匹配，支持中英文）..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={onStatusFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_META[s].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={onPriorityFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="优先级" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部优先级</SelectItem>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {PRIORITY_META[p].label}优先级
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={onSort}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="排序" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created">创建时间</SelectItem>
              <SelectItem value="due">截止日期</SelectItem>
              <SelectItem value="priority">优先级</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={grouped ? "default" : "outline"}
            size="icon"
            className="h-9 w-9"
            onClick={() => setGrouped((v) => !v)}
            aria-label={grouped ? "切换为网格视图" : "切换为按标签分组"}
            title={grouped ? "切换为网格视图" : "切换为按标签分组"}
          >
            {grouped ? (
              <LayoutGrid className="h-4 w-4" />
            ) : (
              <FolderTree className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground">加载中...</div>
      ) : tasks.length === 0 ? (
        <EmptyState hasFilters={hasFilters} onNew={onNew} />
      ) : grouped && groupedTasks ? (
        <div className="space-y-6">
          {groupedTasks.map(([rawTag, tagTasks]) => {
            const UNGROUPED = "__ungrouped__";
            const isUngrouped = rawTag === UNGROUPED;
            const displayName = isUngrouped ? "未分组" : rawTag;
            const color = isUngrouped
              ? "slate"
              : (tagCtx?.colorFor(rawTag) ?? "emerald");
            const meta = TAG_COLOR_META[normalizeTagColor(color)];
            const collapsed = collapsedGroups[rawTag] === true;
            const doneCount = tagTasks.filter(
              (t) => t.status === "done",
            ).length;

            return (
              <section key={rawTag}>
                {/* Big color-block banner header */}
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-4 py-3 mb-3",
                    meta.bannerBg,
                    "border-border/60",
                  )}
                >
                  <span
                    className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
                      meta.dot,
                    )}
                    aria-hidden
                  >
                    <Hash className="h-4 w-4 text-white" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <h2
                        className={cn(
                          "text-lg font-semibold tracking-tight truncate",
                          meta.bannerText,
                        )}
                      >
                        {displayName}
                      </h2>
                      <span
                        className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          meta.soft,
                          meta.softText,
                        )}
                      >
                        {tagTasks.length} 个任务
                        {doneCount > 0 && ` · ${doneCount} 已完成`}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-8 w-8 shrink-0",
                      meta.bannerText,
                      "hover:bg-black/5 dark:hover:bg-white/10",
                    )}
                    onClick={() =>
                      setCollapsedGroups((prev) => ({
                        ...prev,
                        [rawTag]: !prev[rawTag],
                      }))
                    }
                    aria-label={collapsed ? "展开" : "折叠"}
                  >
                    {collapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {!collapsed && (
                  <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                      {tagTasks.map(renderCard)}
                    </AnimatePresence>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {tasks.map(renderCard)}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function EmptyState({
  hasFilters,
  onNew,
}: {
  hasFilters: boolean;
  onNew: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-20 text-center",
        "rounded-xl border border-dashed bg-muted/20",
      )}
    >
      <div className="mb-4 rounded-full bg-muted p-4">
        {hasFilters ? (
          <Search className="h-7 w-7 text-muted-foreground" />
        ) : (
          <Inbox className="h-7 w-7 text-muted-foreground" />
        )}
      </div>
      <h3 className="text-lg font-medium">
        {hasFilters ? "未找到匹配的任务" : "还没有任务"}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-sm">
        {hasFilters
          ? "试着调整搜索关键词或筛选条件。"
          : "从创建第一个任务开始，规划你的每一天。"}
      </p>
      {!hasFilters && (
        <Button onClick={onNew} className="mt-5">
          <ListTodo className="mr-2 h-4 w-4" />
          新建任务
        </Button>
      )}
    </div>
  );
}
