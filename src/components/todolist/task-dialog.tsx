"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarIcon, X, Plus, RotateCcw, Info } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { SubtaskEditor } from "./task-card";
import {
  PRIORITIES,
  PRIORITY_META,
  RECURRENCES,
  RECURRENCE_META,
  STATUSES,
  STATUS_META,
  type Priority,
  type Recurrence,
  type Status,
  type Subtask,
  type TaskData,
  type TaskInput,
} from "@/lib/task-utils";
import { TAG_COLOR_META, normalizeTagColor } from "@/lib/tag-utils";
import { useTagsOptional } from "@/lib/tag-context";
import {
  saveTaskDraft,
  loadTaskDraft,
  clearTaskDraft,
} from "@/lib/tasks-backup";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskData | null; // when editing
  onSave: (input: TaskInput, id?: string) => Promise<void>;
  /** Suggested tags from existing tasks, sorted by frequency. */
  suggestedTags?: string[];
}

const RECURRENCE_LABELS: Record<Recurrence, string> = RECURRENCE_META;

export function TaskDialog({
  open,
  onOpenChange,
  task,
  onSave,
  suggestedTags = [],
}: TaskDialogProps) {
  const isEdit = !!task;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>("medium");
  const [status, setStatus] = useState<Status>("todo");
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [pomodoros, setPomodoros] = useState(0);
  const [saving, setSaving] = useState(false);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const [draftDismissed, setDraftDismissed] = useState(false);

  const tagCtx = useTagsOptional();

  // On open: load task data, OR restore unsaved draft (only for new tasks)
  useEffect(() => {
    if (open) {
      setDraftDismissed(false);
      if (isEdit) {
        // Editing existing task — load its data
        setTitle(task?.title ?? "");
        setDescription(task?.description ?? "");
        setDueDate(task?.dueDate ?? null);
        setPriority(task?.priority ?? "medium");
        setStatus(task?.status ?? "todo");
        setRecurrence(task?.recurrence ?? null);
        setTags(task?.tags ?? []);
        setTagDraft("");
        setSubtasks(task?.subtasks ?? []);
        setPomodoros(task?.pomodoros ?? 0);
        setRestoredFromDraft(false);
      } else {
        // New task — check for unsaved draft from previous session
        const draft = loadTaskDraft();
        if (draft && !draft.editId) {
          setTitle(draft.title);
          setDescription(draft.description);
          setDueDate(draft.dueDate);
          setPriority(draft.priority as Priority);
          setStatus(draft.status as Status);
          setRecurrence(draft.recurrence as Recurrence | null);
          setTags(draft.tags);
          setSubtasks(draft.subtasks as Subtask[]);
          setPomodoros(draft.pomodoros);
          setRestoredFromDraft(true);
        } else {
          setTitle("");
          setDescription("");
          setDueDate(null);
          setPriority("medium");
          setStatus("todo");
          setRecurrence(null);
          setTags([]);
          setTagDraft("");
          setSubtasks([]);
          setPomodoros(0);
          setRestoredFromDraft(false);
        }
      }
    }
  }, [open, isEdit, task]);

  // Auto-save draft (only for new tasks, only when there's content)
  useEffect(() => {
    if (!open || isEdit) return;
    const timer = setTimeout(() => {
      saveTaskDraft({
        editId: null,
        title,
        description,
        dueDate,
        priority,
        status,
        recurrence,
        tags,
        subtasks,
        pomodoros,
        noteMarkdown: null,
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [
    open,
    isEdit,
    title,
    description,
    dueDate,
    priority,
    status,
    recurrence,
    tags,
    subtasks,
    pomodoros,
  ]);

  function addTag() {
    const t = tagDraft.trim().replace(/^#/, "");
    if (!t) return;
    if (!tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagDraft("");
  }

  function addTagByName(name: string) {
    const t = name.trim().replace(/^#/, "");
    if (!t) return;
    if (!tags.includes(t)) {
      setTags([...tags, t]);
    }
  }

  // Filter suggestions: exclude already-added tags, limit to 10
  const availableSuggestions = suggestedTags
    .filter((t) => !tags.includes(t))
    .slice(0, 10);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const input: TaskInput = {
        title,
        description,
        dueDate,
        priority,
        status,
        recurrence,
        tags,
        subtasks,
        pomodoros,
      };
      await onSave(input, task?.id);
      // Clear draft on successful save
      if (!isEdit) clearTaskDraft();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  function discardDraft() {
    clearTaskDraft();
    setTitle("");
    setDescription("");
    setDueDate(null);
    setPriority("medium");
    setStatus("todo");
    setRecurrence(null);
    setTags([]);
    setTagDraft("");
    setSubtasks([]);
    setPomodoros(0);
    setRestoredFromDraft(false);
    setDraftDismissed(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑任务" : "新建任务"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "修改任务的详细信息，保存后会立即生效。"
              : "填写任务的详细信息，标记 * 的字段为必填。"}
          </DialogDescription>
        </DialogHeader>

        {/* Draft restoration banner */}
        {restoredFromDraft && !draftDismissed && !isEdit && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 text-sm">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-amber-800 dark:text-amber-200">
                已恢复上次未保存的草稿
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                你之前输入的内容已自动保存。可以继续编辑，或点击右侧按钮丢弃草稿重新开始。
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={discardDraft}
              className="h-7 text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              丢弃草稿
            </Button>
          </div>
        )}

        {/* Auto-save indicator for new tasks */}
        {!isEdit && (title.trim() || description.trim() || tags.length > 0 || subtasks.length > 0) && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            自动保存草稿中（防止意外关闭丢失）
          </div>
        )}

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title">
              标题 <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：完成季度产品规划文档"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">描述</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="补充任务的目标、背景、注意事项等..."
              rows={3}
            />
          </div>

          {/* Priority + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>优先级</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as Priority)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_META[p].label}优先级
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>状态</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as Status)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due date + Recurrence */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>截止日期</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-9",
                      !dueDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate
                      ? format(new Date(dueDate + "T00:00:00"), "yyyy-MM-dd")
                      : "选择日期"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate ? new Date(dueDate + "T00:00:00") : undefined}
                    onSelect={(d) => {
                      if (d) {
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, "0");
                        const day = String(d.getDate()).padStart(2, "0");
                        setDueDate(`${y}-${m}-${day}`);
                      } else {
                        setDueDate(null);
                      }
                    }}
                    locale={zhCN}
                  />
                  {dueDate && (
                    <div className="border-t p-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full"
                        onClick={() => setDueDate(null)}
                      >
                        清除日期
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label>重复</Label>
              <Select
                value={recurrence ?? "none"}
                onValueChange={(v) =>
                  setRecurrence(v === "none" ? null : (v as Recurrence))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不重复</SelectItem>
                  {RECURRENCES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {RECURRENCE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <Label>标签</Label>
            <div className="flex gap-2">
              <Input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag();
                  }
                }}
                placeholder="输入标签后回车，如：工作、学习"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={addTag}
                size="sm"
              >
                <Plus className="h-3.5 w-3.5" />
                添加
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((tag) => {
                  const color = tagCtx?.colorFor(tag) ?? "emerald";
                  const meta = TAG_COLOR_META[normalizeTagColor(color)];
                  return (
                    <span
                      key={tag}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs",
                        meta.soft,
                        meta.softText,
                        meta.softBorder,
                      )}
                    >
                      <span
                        className={cn("h-1.5 w-1.5 rounded-full", meta.dot)}
                        aria-hidden
                      />
                      {tag}
                      <button
                        type="button"
                        onClick={() => setTags(tags.filter((t) => t !== tag))}
                        className="hover:opacity-70"
                        aria-label={`移除标签 ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            {/* Suggested tags - quick pick */}
            {availableSuggestions.length > 0 && (
              <div className="pt-1">
                <div className="text-[11px] text-muted-foreground mb-1">
                  常用标签（点击添加）
                </div>
                <div className="flex flex-wrap gap-1">
                  {availableSuggestions.map((tag) => {
                    const color = tagCtx?.colorFor(tag) ?? "emerald";
                    const meta = TAG_COLOR_META[normalizeTagColor(color)];
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => addTagByName(tag)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs text-muted-foreground hover:opacity-80 transition-opacity",
                          meta.softBorder,
                        )}
                      >
                        <span
                          className={cn("h-1.5 w-1.5 rounded-full", meta.dot)}
                          aria-hidden
                        />
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Subtasks */}
          <div className="space-y-1.5">
            <Label>子任务</Label>
            <SubtaskEditor subtasks={subtasks} onChange={setSubtasks} />
          </div>

          {/* Pomodoro */}
          <div className="space-y-1.5">
            <Label htmlFor="task-pomodoro">番茄钟数</Label>
            <div className="flex items-center gap-3">
              <Input
                id="task-pomodoro"
                type="number"
                min={0}
                max={99}
                value={pomodoros}
                onChange={(e) =>
                  setPomodoros(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-24"
              />
              <span className="text-xs text-muted-foreground">
                预计完成的番茄钟数量（每个 25 分钟）
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? "保存中..." : isEdit ? "保存修改" : "创建任务"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
