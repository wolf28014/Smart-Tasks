"use client";

import * as React from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadTasksBackup } from "@/lib/tasks-backup";

type SaveState = "idle" | "saving" | "saved" | "offline";

interface AutoSaveIndicatorProps {
  /** When this changes, we show "saving" briefly then "saved". */
  lastMutationAt: number;
  /** True if the last fetch completed successfully. */
  online: boolean;
}

/**
 * Shows a small "自动保存" status indicator in the page header.
 * - idle: 灰色云图标
 * - saving: 旋转图标 + "保存中..."
 * - saved: 绿色对勾 + "已自动保存"
 * - offline: 红色 + "离线模式"
 */
export function AutoSaveIndicator({ lastMutationAt, online }: AutoSaveIndicatorProps) {
  const [state, setState] = React.useState<SaveState>(online ? "saved" : "offline");
  const [lastSavedAt, setLastSavedAt] = React.useState<string>("");

  // When a mutation happens, show "saving" then "saved" after 1s
  React.useEffect(() => {
    if (lastMutationAt === 0) return;
    setState("saving");
    const t = setTimeout(() => {
      setState("saved");
      setLastSavedAt(new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }));
    }, 800);
    return () => clearTimeout(t);
  }, [lastMutationAt]);

  // Online/offline detection
  React.useEffect(() => {
    if (!online) {
      setState("offline");
      return;
    }
    const onOnline = () => setState("saved");
    const onOffline = () => setState("offline");
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [online]);

  // Verify backup exists on mount
  React.useEffect(() => {
    const backup = loadTasksBackup();
    if (backup) {
      setLastSavedAt(
        new Date(backup.savedAt).toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    }
  }, []);

  if (state === "offline") {
    return (
      <div
        className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400"
        title="当前离线，数据已缓存到本地，恢复网络后会自动同步"
      >
        <CloudOff className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">离线模式</span>
      </div>
    );
  }

  if (state === "saving") {
    return (
      <div
        className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400"
        title="正在保存..."
      >
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        <span className="hidden sm:inline">保存中...</span>
      </div>
    );
  }

  // saved or idle
  return (
    <div
      className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400"
      title={`已自动保存${lastSavedAt ? `（最后：${lastSavedAt}）` : ""}`}
    >
      <Cloud className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">
        {lastSavedAt ? `已保存 ${lastSavedAt}` : "已自动保存"}
      </span>
    </div>
  );
}
