"use client";

import * as React from "react";
import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, X, Timer, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { TaskData } from "@/lib/task-utils";

const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

interface PomodoroOverlayProps {
  task: TaskData | null;
  onClose: () => void;
  onComplete: (taskId: string) => Promise<void>;
}

type Phase = "work" | "break";

export function PomodoroOverlay({
  task,
  onClose,
  onComplete,
}: PomodoroOverlayProps) {
  const [phase, setPhase] = useState<Phase>("work");
  const [secondsLeft, setSecondsLeft] = useState(WORK_SECONDS);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs that always hold latest values, so the interval callback stays stable.
  const phaseRef = useRef(phase);
  const taskRef = useRef(task);
  const onCompleteRef = useRef(onComplete);
  React.useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  React.useEffect(() => {
    taskRef.current = task;
  }, [task]);
  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const notify = useCallback((title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body });
      } catch {
        // ignore
      }
    }
  }, []);

  const handlePhaseEnd = useCallback(() => {
    const currentPhase = phaseRef.current;
    const currentTask = taskRef.current;
    if (currentPhase === "work" && currentTask) {
      // Record a pomodoro session (server-side) and bump counter via API.
      // The parent's onComplete handler updates local state.
      onCompleteRef.current(currentTask.id).catch(() => {});
      // Fire-and-forget session log
      fetch("/api/pomodoro/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: currentTask.id, duration: WORK_SECONDS }),
      }).catch(() => {});
      notify("番茄钟完成 🍅", `已完成 1 个番茄钟：${currentTask.title}`);
      toast({
        title: "番茄钟完成 🍅",
        description: `已记录 1 个番茄钟：${currentTask.title}`,
      });
      setPhase("break");
      setSecondsLeft(BREAK_SECONDS);
    } else {
      notify("休息结束", "开始下一个番茄钟吧！");
      toast({
        title: "休息结束",
        description: "开始下一个番茄钟吧！",
      });
      setPhase("work");
      setSecondsLeft(WORK_SECONDS);
    }
  }, [notify]);

  // Reset when task changes
  React.useEffect(() => {
    if (task) {
      setPhase("work");
      setSecondsLeft(WORK_SECONDS);
      setRunning(false);
    }
  }, [task?.id]);

  // Notify on first show
  React.useEffect(() => {
    if (task && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, [task]);

  // Tick — only depends on `running`. Uses refs for everything else.
  React.useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          handlePhaseEnd();
          return phaseRef.current === "work" ? BREAK_SECONDS : WORK_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, handlePhaseEnd]);

  function toggle() {
    setRunning((v) => !v);
  }

  function reset() {
    setRunning(false);
    setSecondsLeft(phase === "work" ? WORK_SECONDS : BREAK_SECONDS);
  }

  function skip() {
    handlePhaseEnd();
  }

  const total = phase === "work" ? WORK_SECONDS : BREAK_SECONDS;
  const progress = ((total - secondsLeft) / total) * 100;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <AnimatePresence>
      {task && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 16 }}
            transition={{ type: "spring", duration: 0.45, bounce: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "w-full max-w-md rounded-2xl bg-card border shadow-2xl p-6 text-center",
              phase === "work"
                ? "border-orange-200 dark:border-orange-900"
                : "border-emerald-200 dark:border-emerald-900",
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                  phase === "work"
                    ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                )}
              >
                {phase === "work" ? (
                  <Timer className="h-3 w-3" />
                ) : (
                  <Coffee className="h-3 w-3" />
                )}
                {phase === "work" ? "专注中" : "休息中"}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onClose}
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <h3 className="text-base font-semibold truncate mb-1">
              {task.title}
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              {phase === "work"
                ? "保持专注，25 分钟后会有提醒"
                : "短暂休息，放松眼睛和肩膀"}
            </p>

            {/* Ring + time */}
            <div className="relative w-48 h-48 mx-auto mb-6">
              <svg
                className="absolute inset-0 -rotate-90"
                viewBox="0 0 100 100"
              >
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted/30"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className={cn(
                    "transition-all duration-300",
                    phase === "work"
                      ? "text-orange-500"
                      : "text-emerald-500",
                  )}
                  style={{
                    strokeDasharray: 2 * Math.PI * 46,
                    strokeDashoffset:
                      2 * Math.PI * 46 * (1 - progress / 100),
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-4xl font-bold tabular-nums">
                  {mm}:{ss}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {phase === "work" ? "专注" : "休息"}
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={reset}
                aria-label="重置"
                className="h-10 w-10"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                onClick={toggle}
                size="lg"
                className={cn(
                  "px-8",
                  phase === "work"
                    ? "bg-orange-500 hover:bg-orange-600 text-white"
                    : "bg-emerald-500 hover:bg-emerald-600 text-white",
                )}
              >
                {running ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    暂停
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    {secondsLeft === total ? "开始" : "继续"}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={skip}
                aria-label="跳过当前阶段"
                className="h-10 w-10"
              >
                <span className="text-xs font-medium">跳过</span>
              </Button>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              已累计 {task.pomodoros} 个番茄钟
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
