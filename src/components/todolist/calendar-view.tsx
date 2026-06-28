"use client";

import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  STATUS_META,
  type Status,
  type TaskData,
} from "@/lib/task-utils";

interface CalendarViewProps {
  tasks: TaskData[];
  onEdit: (task: TaskData) => void;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

export function CalendarView({ tasks, onEdit }: CalendarViewProps) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });

  // Build a map of date -> tasks
  const tasksByDate = useMemo(() => {
    const map: Record<string, TaskData[]> = {};
    for (const t of tasks) {
      if (!t.dueDate) continue;
      (map[t.dueDate] ??= []).push(t);
    }
    return map;
  }, [tasks]);

  // Build calendar grid (6 weeks)
  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startDay = first.getDay(); // 0..6, 0=Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { date: string | null; day: number | null; isToday: boolean; isCurrentMonth: boolean }[] = [];
    // Leading blanks
    for (let i = 0; i < startDay; i++) {
      cells.push({ date: null, day: null, isToday: false, isCurrentMonth: false });
    }
    const todayStr = new Date().toISOString().slice(0, 10);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({
        date: dateStr,
        day: d,
        isToday: dateStr === todayStr,
        isCurrentMonth: true,
      });
    }
    // Trailing blanks to fill 6 weeks (42 cells)
    while (cells.length % 7 !== 0) {
      cells.push({ date: null, day: null, isToday: false, isCurrentMonth: false });
    }
    // Ensure 6 rows
    while (cells.length < 42) {
      cells.push({ date: null, day: null, isToday: false, isCurrentMonth: false });
    }
    return cells;
  }, [cursor]);

  const cursorLabel = `${cursor.getFullYear()} 年 ${cursor.getMonth() + 1} 月`;

  const selectedTasks = selectedDate
    ? tasksByDate[selectedDate] ?? []
    : [];

  function shiftMonth(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  function goToday() {
    const d = new Date();
    setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    setSelectedDate(`${y}-${m}-${day}`);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Calendar */}
      <div className="lg:col-span-2 rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-emerald-500" />
            {cursorLabel}
          </h3>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={goToday}>
              今天
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => shiftMonth(-1)}
              aria-label="上一月"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => shiftMonth(1)}
              aria-label="下一月"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={cn(
                "text-center text-xs font-medium py-2",
                (i === 0 || i === 6)
                  ? "text-rose-500"
                  : "text-muted-foreground",
              )}
            >
              {w}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {grid.map((cell, i) => {
            if (!cell.date) {
              return <div key={i} className="aspect-square" />;
            }
            const dayTasks = tasksByDate[cell.date] ?? [];
            const isSelected = cell.date === selectedDate;
            const statusCounts: Record<Status, number> = {
              todo: 0,
              in_progress: 0,
              done: 0,
              cancelled: 0,
            };
            for (const t of dayTasks) {
              statusCounts[t.status]++;
            }
            const overdue =
              cell.date < new Date().toISOString().slice(0, 10) &&
              dayTasks.some(
                (t) => t.status !== "done" && t.status !== "cancelled",
              );

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(cell.date)}
                className={cn(
                  "aspect-square rounded-lg border text-left p-1.5 flex flex-col transition-all relative",
                  "hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20",
                  isSelected
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-500"
                    : "border-border",
                  cell.isToday && !isSelected && "border-emerald-300",
                )}
              >
                <span
                  className={cn(
                    "text-xs font-medium",
                    cell.isToday
                      ? "inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500 text-white"
                      : overdue
                        ? "text-rose-500"
                        : "text-foreground",
                  )}
                >
                  {cell.day}
                </span>

                {/* Task dots */}
                {dayTasks.length > 0 && (
                  <div className="mt-auto flex flex-wrap gap-0.5">
                    {dayTasks.length <= 4 ? (
                      dayTasks.map((t) => (
                        <span
                          key={t.id}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            STATUS_META[t.status].dot,
                          )}
                          title={t.title}
                        />
                      ))
                    ) : (
                      <>
                        {(["todo", "in_progress", "done"] as Status[]).map(
                          (s) =>
                            statusCounts[s] > 0 && (
                              <span
                                key={s}
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  STATUS_META[s].dot,
                                )}
                              />
                            ),
                        )}
                        <span className="text-[10px] text-muted-foreground leading-none">
                          +{dayTasks.length}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Side panel: tasks for selected date */}
      <div className="rounded-xl border bg-card p-5">
        <h3 className="font-semibold mb-1">
          {selectedDate
            ? formatSelectedDate(selectedDate)
            : "请选择日期"}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          {selectedTasks.length === 0
            ? "该日期没有到期任务"
            : `共 ${selectedTasks.length} 个任务`}
        </p>

        {selectedTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              今天没有到期的任务，享受空闲时光吧。
            </p>
          </div>
        ) : (
          <ul className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {selectedTasks.map((t) => {
              const meta = STATUS_META[t.status];
              return (
                <li key={t.id}>
                  <button
                    onClick={() => onEdit(t)}
                    className="w-full text-left rounded-lg border bg-background p-3 hover:shadow-sm hover:border-foreground/15 transition-all"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-1 h-2 w-2 rounded-full shrink-0",
                          meta.dot,
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            "text-sm font-medium leading-snug",
                            t.status === "done" && "line-through text-muted-foreground",
                            t.status === "cancelled" && "line-through text-muted-foreground",
                          )}
                        >
                          {t.title}
                        </div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              "text-[11px] px-1.5 py-0.5 rounded",
                              meta.bg,
                              meta.color,
                            )}
                          >
                            {meta.label}
                          </span>
                          {t.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="text-[11px] text-emerald-700 dark:text-emerald-300"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function formatSelectedDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  let prefix = "";
  if (dateStr === today) prefix = "今天 · ";
  else if (dateStr === tomorrowStr) prefix = "明天 · ";

  return `${prefix}${d.getMonth() + 1}月${d.getDate()}日 周${weekdays[d.getDay()]}`;
}
