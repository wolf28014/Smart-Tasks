"use client";

import React, { useState } from "react";
import {
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  CalendarDays,
  Repeat,
  Timer,
  Link2,
  ChevronDown,
  ChevronRight,
  FileText,
  Play,
  GripVertical,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  PRIORITY_META,
  RECURRENCE_META,
  STATUS_META,
  escapeRegex,
  formatDueLabel,
  isOverdue,
  type Subtask,
  type TaskData,
} from "@/lib/task-utils";
import { TAG_COLOR_META, normalizeTagColor } from "@/lib/tag-utils";
import { useTagsOptional } from "@/lib/tag-context";

interface TaskCardProps {
  task: TaskData;
  onEdit: (task: TaskData) => void;
  onToggleDone: (task: TaskData) => void;
  onDelete: (id: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onStartPomodoro?: (task: TaskData) => void;
  onOpenNote?: (task: TaskData) => void;
  /** E2: open AI chat drawer scoped to this task */
  onAskAI?: (task: TaskData) => void;
  highlight?: string[]; // terms to highlight (from TF-IDF)
  compact?: boolean;
}

export function TaskCard({
  task,
  onEdit,
  onToggleDone,
  onDelete,
  onToggleSubtask,
  onStartPomodoro,
  onOpenNote,
  onAskAI,
  highlight,
  compact,
}: TaskCardProps) {
  // Default expanded when there are subtasks (per user request).
  // Auto-expand when subtasks are added; respect user's manual collapse.
  const [expanded, setExpanded] = useState(task.subtasks.length > 0);
  const [userTouched, setUserTouched] = useState(false);
  React.useEffect(() => {
    if (!userTouched) {
      setExpanded(task.subtasks.length > 0);
    }
  }, [task.subtasks.length, userTouched]);

  const tagCtx = useTagsOptional();
  const status = STATUS_META[task.status];
  const priority = PRIORITY_META[task.priority];
  const overdue = isOverdue(task.dueDate, task.status);
  const done = task.status === "done";
  const cancelled = task.status === "cancelled";

  const subDone = task.subtasks.filter((s) => s.done).length;
  const subTotal = task.subtasks.length;
  const subProgress = subTotal > 0 ? (subDone / subTotal) * 100 : 0;

  // Highlight matched terms (TF-IDF) in title and description
  function highlightText(text: string): React.ReactNode {
    if (!highlight || highlight.length === 0) return text;
    const terms = highlight
      .filter((t) => t.length > 0)
      .map((t) => escapeRegex(t));
    if (terms.length === 0) return text;
    const re = new RegExp(`(${terms.join("|")})`, "gi");
    const parts = text.split(re);
    const testRe = new RegExp(`^(?:${terms.join("|")})$`, "i");
    return parts.map((part, i) =>
      testRe.test(part) ? (
        <mark
          key={i}
          className="bg-yellow-200 dark:bg-yellow-500/40 rounded px-0.5"
        >
          {part}
        </mark>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      className={cn(
        "group relative rounded-xl border bg-card text-card-foreground shadow-sm transition-all",
        "hover:shadow-md hover:border-foreground/15",
        done && "opacity-70",
        cancelled && "opacity-60",
        overdue && "border-rose-300 dark:border-rose-800",
      )}
    >
      {/* Priority stripe */}
      <div
        className={cn(
          "absolute left-0 top-0 h-full w-1 rounded-l-xl",
          task.priority === "high" && "bg-rose-500",
          task.priority === "medium" && "bg-amber-500",
          task.priority === "low" && "bg-slate-300 dark:bg-slate-600",
        )}
      />

      <div className={cn("p-4 pl-5", compact && "p-3 pl-4")}>
        {/* Header: checkbox + title + actions */}
        <div className="flex items-start gap-3">
          <Checkbox
            checked={done}
            onCheckedChange={() => onToggleDone(task)}
            disabled={cancelled}
            className="mt-1 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {subTotal > 0 && (
                <button
                  onClick={() => {
                    setUserTouched(true);
                    setExpanded((v) => !v);
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  aria-label={expanded ? "折叠子任务" : "展开子任务"}
                >
                  {expanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              )}
              <h3
                className={cn(
                  "text-[15px] font-semibold leading-snug break-words text-foreground tracking-tight pr-1 group-hover:pr-20 transition-all duration-150",
                  done && "line-through text-muted-foreground font-medium",
                  cancelled && "line-through text-muted-foreground font-medium",
                )}
              >
                {highlightText(task.title)}
              </h3>
            </div>
            {task.description && !compact && (
              <p className="mt-1.5 text-[13px] text-muted-foreground/80 line-clamp-2 leading-relaxed">
                {highlightText(task.description)}
              </p>
            )}
          </div>

          {/* Hover actions — absolute positioned in the top-right corner.
              The title container gets pr-20 on hover to make room, so
              buttons never overlap the title text. */}
          <div className="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {onAskAI && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 hover:text-emerald-600"
                onClick={() => onAskAI(task)}
                aria-label="问问 AI"
                title="问问 AI"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
            )}
            {onStartPomodoro && !cancelled && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 hover:text-orange-600"
                onClick={() => onStartPomodoro(task)}
                aria-label="开始番茄钟"
                title="开始番茄钟"
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
            )}
            {onOpenNote && (
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  "h-7 w-7",
                  task.noteMarkdown
                    ? "text-emerald-600 hover:text-emerald-700"
                    : "",
                )}
                onClick={() => onOpenNote(task)}
                aria-label={task.noteMarkdown ? "查看笔记" : "添加笔记"}
                title={task.noteMarkdown ? "查看笔记" : "添加笔记"}
              >
                <FileText className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onEdit(task)}
              aria-label="编辑"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 hover:text-rose-600"
              onClick={() => onDelete(task.id)}
              aria-label="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Meta row: priority badge, status badge, due date, recurrence */}
        <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center gap-1.5 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
              priority.bg,
              priority.color,
            )}
          >
            <span aria-hidden>{priority.icon}</span>
            {priority.label}优先级
          </span>

          {task.status !== "todo" && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                status.bg,
                status.color,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
              {status.label}
            </span>
          )}

          {task.dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs",
                overdue
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <CalendarDays className="h-3 w-3" />
              {formatDueLabel(task.dueDate)}
              {overdue && " · 逾期"}
            </span>
          )}

          {task.recurrence && (
            <span className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-0.5 text-xs text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
              <Repeat className="h-3 w-3" />
              {RECURRENCE_META[task.recurrence]}
            </span>
          )}

          {task.pomodoros > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-orange-100 px-2 py-0.5 text-xs text-orange-700 dark:bg-orange-950/40 dark:text-orange-300">
              <Timer className="h-3 w-3" />
              {task.pomodoros}
            </span>
          )}

          {task.tags.map((tag) => {
            const color = tagCtx?.colorFor(tag) ?? "emerald";
            const meta = TAG_COLOR_META[normalizeTagColor(color)];
            return (
              <Badge
                key={tag}
                variant="outline"
                className={cn(
                  "text-[11px] font-normal border",
                  meta.soft,
                  meta.softText,
                  meta.softBorder,
                )}
              >
                {tag}
              </Badge>
            );
          })}
        </div>

        {/* Subtask progress bar */}
        {subTotal > 0 && !expanded && (
          <div className="mt-3 flex items-center gap-2">
            <Progress
              value={subProgress}
              className="h-1.5 flex-1 [&>[data-slot=progress-indicator]]:bg-emerald-500"
            />
            <span className="text-xs text-muted-foreground tabular-nums">
              {subDone}/{subTotal}
            </span>
          </div>
        )}

        {/* Expanded subtask list */}
        {subTotal > 0 && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="mt-3 space-y-1.5 border-t pt-3"
          >
            {task.subtasks.map((s) => {
              const sOverdue =
                s.dueDate && !s.done && s.dueDate < new Date().toISOString().slice(0, 10);
              return (
                <label
                  key={s.id}
                  className="flex items-center gap-2 cursor-pointer rounded px-1 py-0.5 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={s.done}
                    onCheckedChange={() => onToggleSubtask(task.id, s.id)}
                    className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                  />
                  <span
                    className={cn(
                      "text-sm flex-1",
                      s.done && "line-through text-muted-foreground",
                    )}
                  >
                    {s.title}
                  </span>
                  {s.dueDate && (
                    <span
                      className={cn(
                        "text-[11px] inline-flex items-center gap-1 px-1.5 py-0.5 rounded",
                        sOverdue
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <CalendarDays className="h-3 w-3" />
                      {formatDueLabel(s.dueDate)}
                      {sOverdue && " · 逾期"}
                    </span>
                  )}
                </label>
              );
            })}
            <div className="pt-1">
              <Progress
                value={subProgress}
                className="h-1.5 [&>[data-slot=progress-indicator]]:bg-emerald-500"
              />
            </div>
          </motion.div>
        )}

        {/* Dependencies note */}
        {task.dependsOn.length > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Link2 className="h-3 w-3" />
            依赖 {task.dependsOn.length} 个前置任务
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Compact subtask add row (used inside edit dialog; we keep a tiny helper here)
export function SubtaskEditor({
  subtasks,
  onChange,
}: {
  subtasks: Subtask[];
  onChange: (next: Subtask[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [draftDue, setDraftDue] = useState("");

  // dnd-kit setup for reordering
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function add() {
    const t = draft.trim();
    if (!t) return;
    onChange([
      ...subtasks,
      {
        id: `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title: t,
        done: false,
        order: subtasks.length,
        dueDate: draftDue || null,
      },
    ]);
    setDraft("");
    setDraftDue("");
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = subtasks.findIndex((s) => s.id === active.id);
    const newIndex = subtasks.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(subtasks, oldIndex, newIndex).map((s, i) => ({
      ...s,
      order: i,
    }));
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {subtasks.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={subtasks.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-1">
              {subtasks.map((s, i) => (
                <SortableSubtaskItem
                  key={s.id}
                  subtask={s}
                  onChange={(updated) => {
                    const next = [...subtasks];
                    next[i] = updated;
                    onChange(next);
                  }}
                  onRemove={() =>
                    onChange(subtasks.filter((x) => x.id !== s.id))
                  }
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      <div className="flex gap-2 flex-wrap">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="添加子任务，回车确认"
          className="h-8 flex-1 min-w-[140px]"
        />
        <Input
          type="date"
          value={draftDue}
          onChange={(e) => setDraftDue(e.target.value)}
          className="h-8 w-[150px]"
          aria-label="子任务截止日期"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={add}
          className="h-8"
        >
          <Plus className="h-3.5 w-3.5" />
          添加
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        提示：拖动左侧手柄可调整子任务顺序，可选设置每个子任务的截止日期。
      </p>
    </div>
  );
}

function SortableSubtaskItem({
  subtask,
  onChange,
  onRemove,
}: {
  subtask: Subtask;
  onChange: (s: Subtask) => void;
  onRemove: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  } as React.CSSProperties;
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 group rounded-md border border-transparent px-1 py-0.5",
        isDragging && "border-border bg-muted shadow-sm",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-foreground touch-none px-0.5"
        aria-label="拖动排序"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <Checkbox
        checked={subtask.done}
        onCheckedChange={(v) => onChange({ ...subtask, done: v === true })}
        className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
      />
      <Input
        value={subtask.title}
        onChange={(e) => onChange({ ...subtask, title: e.target.value })}
        className="h-8 flex-1"
      />
      <Input
        type="date"
        value={subtask.dueDate ?? ""}
        onChange={(e) =>
          onChange({ ...subtask, dueDate: e.target.value || null })
        }
        className="h-8 w-[150px]"
        aria-label="子任务截止日期"
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-rose-600"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

// A small inline status toggle for the Kanban column header action.
export function StatusToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const options = Object.entries(STATUS_META).map(([k, v]) => ({
    key: k,
    label: v.label,
  }));
  return (
    <div className="flex items-center gap-1">
      {options.map((o) => (
        <Button
          key={o.key}
          size="sm"
          variant={value === o.key ? "default" : "ghost"}
          className="h-7 text-xs"
          onClick={() => onChange(o.key)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  );
}

export { Check };
