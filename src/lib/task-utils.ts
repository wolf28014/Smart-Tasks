// Shared constants and helpers for the TodoList app.
// Mirrors the reference task_model.py semantics.

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUSES = ["todo", "in_progress", "done", "cancelled"] as const;
export type Status = (typeof STATUSES)[number];

export const RECURRENCES = ["daily", "weekly", "monthly"] as const;
export type Recurrence = (typeof RECURRENCES)[number];

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
  order?: number;
  dueDate?: string | null; // 'YYYY-MM-DD' or null
}

// Allowed status transitions (state machine), mirrors _TRANSITIONS in task_model.py
const TRANSITIONS: Record<Status, Set<Status>> = {
  todo: new Set<Status>(["in_progress", "done", "cancelled"]),
  in_progress: new Set<Status>(["todo", "done", "cancelled"]),
  done: new Set<Status>(["todo", "in_progress"]),
  cancelled: new Set<Status>(["todo"]),
};

export function canTransition(from: Status, to: Status): boolean {
  if (from === to) return true;
  return TRANSITIONS[from]?.has(to) ?? false;
}

// --- Display metadata -------------------------------------------------------

export const STATUS_META: Record<
  Status,
  { label: string; color: string; bg: string; ring: string; dot: string }
> = {
  todo: {
    label: "待办",
    color: "text-slate-700 dark:text-slate-300",
    bg: "bg-slate-100 dark:bg-slate-800",
    ring: "ring-slate-200 dark:ring-slate-700",
    dot: "bg-slate-400",
  },
  in_progress: {
    label: "进行中",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-100 dark:bg-amber-950/40",
    ring: "ring-amber-200 dark:ring-amber-800",
    dot: "bg-amber-500",
  },
  done: {
    label: "已完成",
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-100 dark:bg-emerald-950/40",
    ring: "ring-emerald-200 dark:ring-emerald-800",
    dot: "bg-emerald-500",
  },
  cancelled: {
    label: "已取消",
    color: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-100 dark:bg-rose-950/40",
    ring: "ring-rose-200 dark:ring-rose-800",
    dot: "bg-rose-500",
  },
};

export const PRIORITY_META: Record<
  Priority,
  { label: string; color: string; bg: string; icon: string }
> = {
  low: {
    label: "低",
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-100 dark:bg-slate-800",
    icon: "▽",
  },
  medium: {
    label: "中",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-100 dark:bg-amber-950/40",
    icon: "◁",
  },
  high: {
    label: "高",
    color: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-100 dark:bg-rose-950/40",
    icon: "▲",
  },
};

export const RECURRENCE_META: Record<Recurrence, string> = {
  daily: "每天",
  weekly: "每周",
  monthly: "每月",
};

// --- Date helpers -----------------------------------------------------------

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isOverdue(dueDate: string | null, status: Status): boolean {
  if (!dueDate) return false;
  if (status === "done" || status === "cancelled") return false;
  return dueDate < todayISO();
}

export function isDueToday(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return dueDate === todayISO();
}

export function daysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate + "T00:00:00");
  const today = new Date(todayISO() + "T00:00:00");
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDueLabel(dueDate: string | null): string {
  if (!dueDate) return "";
  const d = daysUntilDue(dueDate);
  if (d === null) return "";
  if (d === 0) return "今天";
  if (d === 1) return "明天";
  if (d === -1) return "昨天";
  if (d > 0 && d <= 7) return `${d} 天后`;
  if (d < 0) return `逾期 ${-d} 天`;
  // Fallback to a date string
  const dt = new Date(dueDate + "T00:00:00");
  return `${dt.getMonth() + 1}月${dt.getDate()}日`;
}

// --- Types ------------------------------------------------------------------

export interface TaskData {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  priority: Priority;
  status: Status;
  recurrence: Recurrence | null;
  tags: string[];
  subtasks: Subtask[];
  dependsOn: string[];
  pomodoros: number;
  noteMarkdown: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  deletedAt: string | null;
}

export interface TaskInput {
  title: string;
  description?: string;
  dueDate?: string | null;
  priority?: Priority;
  status?: Status;
  recurrence?: Recurrence | null;
  tags?: string[];
  subtasks?: Subtask[];
  dependsOn?: string[];
  pomodoros?: number;
  noteMarkdown?: string | null;
}

// --- TF-IDF search (mirrors reference search_engine.py) --------------------

// Tokenize: lowercase, split on non-alphanumeric (CJK characters are kept
// individually so Chinese queries work without a tokenizer).
export function tokenize(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  // Match either an english/digit run or a single CJK character
  const matches = lower.match(/[a-z0-9]+|[\u4e00-\u9fa5]/g);
  return matches ?? [];
}

function buildTf(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  // Normalize by max frequency (the classic SMART-n variant used in the
  // reference project).
  let max = 1;
  for (const v of tf.values()) if (v > max) max = v;
  for (const [k, v] of tf) tf.set(k, v / max);
  return tf;
}

export interface TfIdfIndex {
  docs: { id: string; tokens: string[]; tf: Map<string, number> }[];
  df: Map<string, number>; // document frequency
  n: number;
}

export function buildIndex<Task extends { id: string }>(
  tasks: Task[],
  getText: (t: Task) => string,
): TfIdfIndex {
  const docs = tasks.map((t) => {
    const tokens = tokenize(getText(t));
    return { id: t.id, tokens, tf: buildTf(tokens) };
  });
  const df = new Map<string, number>();
  for (const d of docs) {
    for (const term of new Set(d.tokens)) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }
  return { docs, df, n: docs.length };
}

export function search<Task extends { id: string }>(
  index: TfIdfIndex,
  tasks: Task[],
  query: string,
): { task: Task; score: number; matchedTerms: Set<string> }[] {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];
  const idf = (term: string) =>
    Math.log((index.n + 1) / ((index.df.get(term) ?? 0) + 1)) + 1;
  const qTf = buildTf(qTokens);
  const qVec = new Map<string, number>();
  for (const [term, tf] of qTf) {
    qVec.set(term, tf * idf(term));
  }

  const results: { task: Task; score: number; matchedTerms: Set<string> }[] = [];
  for (const doc of index.docs) {
    let score = 0;
    const matched = new Set<string>();
    for (const [term, qWeight] of qVec) {
      const tf = doc.tf.get(term);
      if (tf !== undefined) {
        score += tf * idf(term) * qWeight;
        matched.add(term);
      }
    }
    if (score > 0) {
      const task = tasks.find((t) => t.id === doc.id);
      if (task) results.push({ task, score, matchedTerms: matched });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results;
}

// Escape a string so it is safe to use as a literal regex source.
export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- Backlinks (wikilink extraction) ---------------------------------------
//
// In a task's Markdown note, [[task title]] or [[task:ID]] creates a link
// to another task. We extract these so we can build a bidirectional graph.

// Matches [[anything-except-brackets]]
const WIKILINK_RE = /\[\[([^\[\]]+)\]\]/g;

export interface ParsedWikiLink {
  raw: string; // the full [[...]]
  target: string; // the inner text
  targetId: string | null; // if inner text matches "id:<cuid>"
}

export function extractWikiLinks(markdown: string | null): ParsedWikiLink[] {
  if (!markdown) return [];
  const out: ParsedWikiLink[] = [];
  let m: RegExpExecArray | null;
  WIKILINK_RE.lastIndex = 0;
  while ((m = WIKILINK_RE.exec(markdown)) !== null) {
    const inner = m[1].trim();
    const idMatch = inner.match(/^id:([a-z0-9]+)$/i);
    out.push({
      raw: m[0],
      target: inner,
      targetId: idMatch ? idMatch[1] : null,
    });
  }
  return out;
}

// Resolve wiki-link targets to actual task IDs.
// Strategy:
//   1. If the link starts with "id:", use that ID directly.
//   2. Otherwise, treat the target as a task title and find the first task
//      whose title matches (case-insensitive, trimmed).
export function resolveBacklinks<Task extends { id: string; title: string; noteMarkdown: string | null }>(
  tasks: Task[],
): {
  // taskId -> array of task IDs that link TO it (incoming backlinks)
  incoming: Record<string, string[]>;
  // taskId -> array of task IDs that it links TO (outgoing forward links)
  outgoing: Record<string, string[]>;
} {
  const incoming: Record<string, string[]> = {};
  const outgoing: Record<string, string[]> = {};
  const titleIndex = new Map<string, Task>();
  for (const t of tasks) {
    titleIndex.set(t.title.trim().toLowerCase(), t);
  }
  for (const t of tasks) {
    const links = extractWikiLinks(t.noteMarkdown);
    const targets = new Set<string>();
    for (const link of links) {
      let target: Task | undefined;
      if (link.targetId) {
        target = tasks.find((x) => x.id === link.targetId);
      } else {
        target = titleIndex.get(link.target.toLowerCase());
      }
      if (target && target.id !== t.id) {
        targets.add(target.id);
      }
    }
    if (targets.size > 0) {
      outgoing[t.id] = Array.from(targets);
      for (const targetId of targets) {
        (incoming[targetId] ??= []).push(t.id);
      }
    }
  }
  return { incoming, outgoing };
}
