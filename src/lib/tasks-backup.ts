"use client";

import * as React from "react";
import type { TaskData } from "@/lib/task-utils";

const STORAGE_KEY = "todolist.tasks.backup.v1";
const DRAFT_KEY = "todolist.task-draft.v1";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface BackupPayload {
  savedAt: string; // ISO
  tasks: TaskData[];
}

// Save tasks snapshot to localStorage (called periodically and on mutations).
export function saveTasksBackup(tasks: TaskData[]) {
  if (typeof window === "undefined") return;
  try {
    const payload: BackupPayload = {
      savedAt: new Date().toISOString(),
      tasks,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage might be full or disabled — ignore
  }
}

// Load tasks snapshot from localStorage. Returns null if no backup or expired.
export function loadTasksBackup(): BackupPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as BackupPayload;
    const age = Date.now() - new Date(payload.savedAt).getTime();
    if (age > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// Clear backup (after successful server sync that we know is fresher).
export function clearTasksBackup() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// Hook that auto-saves tasks to localStorage whenever they change,
// plus on a 30-second interval as a safety net.
export function useTasksBackup(tasks: TaskData[]) {
  React.useEffect(() => {
    saveTasksBackup(tasks);
  }, [tasks]);

  React.useEffect(() => {
    const interval = setInterval(() => {
      saveTasksBackup(tasks);
    }, 30000);
    const onHide = () => saveTasksBackup(tasks);
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveTasksBackup(tasks);
    });
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", onHide);
    };
  }, [tasks]);
}

// ─── Task dialog draft autosave ────────────────────────────────────────
//
// When user is creating/editing a task but closes the dialog without
// saving (accidental click, page refresh, browser crash), the draft is
// preserved in localStorage so it can be restored next time.

export interface TaskDraft {
  // For new tasks, editId is null. For editing, it's the task id.
  editId: string | null;
  title: string;
  description: string;
  dueDate: string | null;
  priority: string;
  status: string;
  recurrence: string | null;
  tags: string[];
  subtasks: { id: string; title: string; done: boolean; order?: number; dueDate?: string | null }[];
  pomodoros: number;
  noteMarkdown: string | null;
  savedAt: string; // ISO timestamp
}

export function saveTaskDraft(draft: Omit<TaskDraft, "savedAt">) {
  if (typeof window === "undefined") return;
  // Don't save empty drafts (no title, no description, no tags, no subtasks)
  if (
    !draft.title.trim() &&
    !draft.description.trim() &&
    draft.tags.length === 0 &&
    draft.subtasks.length === 0
  ) {
    clearTaskDraft();
    return;
  }
  try {
    const payload: TaskDraft = { ...draft, savedAt: new Date().toISOString() };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function loadTaskDraft(): TaskDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as TaskDraft;
    // Expire drafts after 24 hours
    const age = Date.now() - new Date(payload.savedAt).getTime();
    if (age > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export function clearTaskDraft() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

