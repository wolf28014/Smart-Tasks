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
import { Calendar as CalendarIcon, X, Plus, RotateCcw, Info, Sparkles, Loader2 } from "lucide-react";
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
import { useAIOptional } from "./ai-provider";
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
  const ai = useAIOptional();

  // A1: AI subtask splitting
  const [aiSplitting, setAiSplitting] = useState(false);
  const [aiSplitError, setAiSplitError] = useState<string | null>(null);
  const [aiSplitPreview, setAiSplitPreview] = useState<
    { title: string; rationale?: string }[] | null
  >(null);

  async function handleAiSplit() {
    if (!title.trim()) {
      setAiSplitError("请先输入任务标题");
      return;
    }
    setAiSplitting(true);
    setAiSplitError(null);
    setAiSplitPreview(null);
    try {
      const res = await fetch("/api/ai/split-subtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "AI 拆解失败");
      }
      const data = await res.json();
      setAiSplitPreview(data.subtasks ?? []);
    } catch (err) {
      setAiSplitError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setAiSplitting(false);
    }
  }

  function applyAiSplit() {
    if (!aiSplitPreview) return;
    const newSubtasks = aiSplitPreview.map((s, i) => ({
      id: `s_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
      title: s.title,
      done: false,
      order: subtasks.length + i,
      dueDate: null,
    }));
    setSubtasks([...subtasks, ...newSubtasks]);
    setAiSplitPreview(null);
  }

  // A4: AI tag suggestions
  const [aiTagLoading, setAiTagLoading] = useState(false);
  const [aiTagSuggestion, setAiTagSuggestion] = useState<{
    suggested: string[];
    newCandidates: string[];
  } | null>(null);
  const [aiTagError, setAiTagError] = useState<string | null>(null);

  async function handleAiSuggestTags() {
    if (!title.trim()) {
      setAiTagError("请先输入任务标题");
      return;
    }
    setAiTagLoading(true);
    setAiTagError(null);
    setAiTagSuggestion(null);
    try {
      const res = await fetch("/api/ai/suggest-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          existingTags: suggestedTags,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "AI 标签建议失败");
      }
      const data = await res.json();
      setAiTagSuggestion({
        suggested: data.suggested ?? [],
        newCandidates: data.newCandidates ?? [],
      });
    } catch (err) {
      setAiTagError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setAiTagLoading(false);
    }
  }

  function applySuggestedTag(tag: string) {
    if (!tags.includes(tag)) setTags([...tags, tag]);
    setAiTagSuggestion((prev) =>
      prev
        ? {
            ...prev,
            suggested: prev.suggested.filter((t) => t !== tag),
          }
        : null,
    );
  }

  function applyNewCandidate(tag: string) {
    const t = tag.trim().replace(/^#/, "");
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setAiTagSuggestion((prev) =>
      prev
        ? {
            ...prev,
            newCandidates: prev.newCandidates.filter((x) => x !== tag),
          }
        : null,
    );
  }

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
            <div className="flex items-center justify-between">
              <Label>标签</Label>
              {ai?.enabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                  onClick={handleAiSuggestTags}
                  disabled={aiTagLoading || !title.trim()}
                >
                  {aiTagLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {aiTagLoading ? "AI 推荐中..." : "AI 推荐"}
                </Button>
              )}
            </div>
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

            {/* AI tag suggestion results */}
            {aiTagError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 pt-1">
                {aiTagError}
              </p>
            )}
            {aiTagSuggestion &&
              (aiTagSuggestion.suggested.length > 0 ||
                aiTagSuggestion.newCandidates.length > 0) && (
                <div className="pt-1 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-2 space-y-1.5">
                  <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    AI 标签推荐
                  </div>
                  {aiTagSuggestion.suggested.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {aiTagSuggestion.suggested.map((tag) => {
                        const color = tagCtx?.colorFor(tag) ?? "emerald";
                        const meta = TAG_COLOR_META[normalizeTagColor(color)];
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => applySuggestedTag(tag)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs hover:opacity-80 transition-opacity",
                              meta.soft,
                              meta.softText,
                              meta.softBorder,
                            )}
                          >
                            <Plus className="h-2.5 w-2.5" />
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {aiTagSuggestion.newCandidates.length > 0 && (
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-1">
                        新标签建议（点击创建并添加）
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {aiTagSuggestion.newCandidates.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => applyNewCandidate(tag)}
                            className="inline-flex items-center gap-1 rounded-md border border-dashed border-emerald-300 dark:border-emerald-700 bg-background px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                          >
                            <Plus className="h-2.5 w-2.5" />
                            {tag}
                            <span className="text-[10px] text-muted-foreground">新</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* Subtasks */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>子任务</Label>
              {ai?.enabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                  onClick={handleAiSplit}
                  disabled={aiSplitting || !title.trim()}
                >
                  {aiSplitting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  {aiSplitting ? "AI 拆解中..." : "AI 拆解"}
                </Button>
              )}
            </div>
            <SubtaskEditor subtasks={subtasks} onChange={setSubtasks} />

            {/* AI split preview */}
            {aiSplitError && (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {aiSplitError}
              </p>
            )}
            {aiSplitPreview && aiSplitPreview.length > 0 && (
              <div className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 space-y-1.5">
                <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI 建议的 {aiSplitPreview.length} 个子任务
                </div>
                <ul className="space-y-1">
                  {aiSplitPreview.map((s, i) => (
                    <li key={i} className="text-xs flex items-start gap-1.5">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      <div>
                        <div className="text-foreground">{s.title}</div>
                        {s.rationale && (
                          <div className="text-muted-foreground text-[11px] mt-0.5">
                            {s.rationale}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-1.5 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={applyAiSplit}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    全部添加
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setAiSplitPreview(null)}
                  >
                    忽略
                  </Button>
                </div>
              </div>
            )}
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
