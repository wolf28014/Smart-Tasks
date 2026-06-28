"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PRIORITY_META,
  STATUS_META,
  type Status,
  type TaskData,
} from "@/lib/task-utils";

interface GanttViewProps {
  tasks: TaskData[];
  onEdit: (task: TaskData) => void;
}

const STATUS_BAR_COLORS: Record<Status, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-amber-500",
  done: "bg-emerald-500",
  cancelled: "bg-rose-400",
};

const PRIORITY_BORDER: Record<string, string> = {
  high: "border-rose-500",
  medium: "border-amber-500",
  low: "border-slate-300",
};

// Each day cell is DAY_WIDTH pixels wide
const DAY_WIDTH_DEFAULT = 36;

function parseDate(s: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function formatDateLabel(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function GanttView({ tasks, onEdit }: GanttViewProps) {
  const [dayWidth, setDayWidth] = React.useState(DAY_WIDTH_DEFAULT);
  const [cursor, setCursor] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7); // start 1 week ago
    return startOfDay(d);
  });

  // Determine visible window (30 days at default zoom, more at smaller width)
  const visibleDays = Math.max(14, Math.min(90, Math.round(1200 / dayWidth)));
  const windowEnd = addDays(cursor, visibleDays - 1);

  // Tasks that have at least a dueDate or are within the window
  const ganttTasks = React.useMemo(() => {
    return tasks
      .filter((t) => t.status !== "cancelled")
      .map((t) => {
        const due = parseDate(t.dueDate);
        const created = parseDate(t.createdAt.slice(0, 10));
        // Bar start: createdAt (clamped to window start) — fallback to due date - 1 day
        let start = created ?? (due ? addDays(due, -1) : null);
        let end = due ?? start;
        if (!start || !end) return null;
        if (end < start) end = start;
        return { task: t, start, end };
      })
      .filter(
        (
          x,
        ): x is { task: TaskData; start: Date; end: Date } =>
          x !== null && x.end >= cursor && x.start <= windowEnd,
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [tasks, cursor, windowEnd]);

  const days = React.useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < visibleDays; i++) {
      arr.push(addDays(cursor, i));
    }
    return arr;
  }, [cursor, visibleDays]);

  const today = startOfDay(new Date());
  const todayIndex = diffDays(cursor, today);

  // Group days into months for the header
  const monthGroups = React.useMemo(() => {
    const groups: { label: string; days: number; year: number; month: number }[] = [];
    for (const d of days) {
      const last = groups[groups.length - 1];
      if (last && last.year === d.getFullYear() && last.month === d.getMonth()) {
        last.days++;
      } else {
        groups.push({
          label: `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`,
          days: 1,
          year: d.getFullYear(),
          month: d.getMonth(),
        });
      }
    }
    return groups;
  }, [days]);

  function shift(days: number) {
    setCursor((c) => addDays(c, days));
  }

  function goToday() {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    setCursor(startOfDay(d));
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold">甘特图</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            按任务创建时间到截止日期绘制时间条，支持缩放与平移，点击任务条可编辑
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={goToday}>
            今天
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => shift(-7)}
            aria-label="前 7 天"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => shift(7)}
            aria-label="后 7 天"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setDayWidth((w) => Math.max(16, w - 6))}
            aria-label="缩小"
            disabled={dayWidth <= 16}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setDayWidth((w) => Math.min(80, w + 6))}
            aria-label="放大"
            disabled={dayWidth >= 80}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Gantt grid */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 280 + days.length * dayWidth }}>
            {/* Header: month row + day row */}
            <div className="sticky top-0 z-10 bg-card border-b">
              {/* Month row */}
              <div className="flex h-6 border-b">
                <div className="w-[280px] shrink-0 border-r flex items-center px-3 text-xs font-medium text-muted-foreground">
                  任务
                </div>
                <div className="flex flex-1">
                  {monthGroups.map((g, i) => (
                    <div
                      key={i}
                      style={{ width: g.days * dayWidth }}
                      className="text-xs font-medium text-center self-center border-r last:border-r-0"
                    >
                      {g.label}
                    </div>
                  ))}
                </div>
              </div>
              {/* Day row */}
              <div className="flex h-7">
                <div className="w-[280px] shrink-0 border-r" />
                <div className="flex flex-1">
                  {days.map((d, i) => {
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const isToday = diffDays(cursor, d) === todayIndex;
                    return (
                      <div
                        key={i}
                        style={{ width: dayWidth }}
                        className={cn(
                          "text-[10px] text-center self-center border-r last:border-r-0",
                          isWeekend && "text-rose-400",
                          isToday && "font-bold text-emerald-600",
                        )}
                      >
                        {dayWidth >= 24 ? d.getDate() : ""}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Today vertical line marker (in the day columns area) */}
            {todayIndex >= 0 && todayIndex < visibleDays && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 w-px bg-emerald-500/40"
                style={{ left: 280 + todayIndex * dayWidth + dayWidth / 2 }}
              />
            )}

            {/* Rows */}
            {ganttTasks.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                当前时间窗口内没有带截止日期的任务
              </div>
            ) : (
              ganttTasks.map(({ task, start, end }) => {
                const startOffset = Math.max(0, diffDays(cursor, start));
                const barLength = Math.max(
                  1,
                  diffDays(start, end) + 1,
                );
                const isOverdue =
                  end < today &&
                  task.status !== "done" &&
                  task.status !== "cancelled";
                return (
                  <div
                    key={task.id}
                    className="flex items-stretch border-b last:border-b-0 hover:bg-muted/30"
                  >
                    <div className="w-[280px] shrink-0 border-r px-3 py-2 flex items-center gap-2">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          STATUS_META[task.status].dot,
                        )}
                      />
                      <button
                        onClick={() => onEdit(task)}
                        className="text-sm text-left hover:text-emerald-600 line-clamp-1 flex-1"
                        title={task.title}
                      >
                        {task.title}
                      </button>
                      <span
                        className={cn(
                          "text-[10px] px-1 py-0.5 rounded shrink-0",
                          PRIORITY_META[task.priority].bg,
                          PRIORITY_META[task.priority].color,
                        )}
                      >
                        {PRIORITY_META[task.priority].label}
                      </span>
                    </div>
                    <div
                      className="relative flex-1"
                      style={{ height: 40 }}
                    >
                      {/* Weekend columns shading */}
                      {days.map((d, i) => {
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        return isWeekend ? (
                          <div
                            key={i}
                            className="absolute top-0 bottom-0 bg-muted/40"
                            style={{
                              left: i * dayWidth,
                              width: dayWidth,
                            }}
                          />
                        ) : null;
                      })}
                      {/* Today line within row */}
                      {todayIndex >= 0 && todayIndex < visibleDays && (
                        <div
                          className="absolute top-0 bottom-0 w-px bg-emerald-500/40 pointer-events-none"
                          style={{
                            left: todayIndex * dayWidth + dayWidth / 2,
                          }}
                        />
                      )}
                      {/* Task bar */}
                      <button
                        onClick={() => onEdit(task)}
                        className={cn(
                          "absolute top-1/2 -translate-y-1/2 h-6 rounded-md border-l-4 px-1.5 text-[10px] text-white flex items-center overflow-hidden shadow-sm hover:shadow-md transition-shadow",
                          STATUS_BAR_COLORS[task.status],
                          PRIORITY_BORDER[task.priority],
                          isOverdue && "ring-2 ring-rose-300",
                        )}
                        style={{
                          left: startOffset * dayWidth + 1,
                          width: Math.max(
                            barLength * dayWidth - 2,
                            dayWidth - 2,
                          ),
                        }}
                        title={`${task.title} · ${start
                          .toISOString()
                          .slice(0, 10)} → ${end.toISOString().slice(0, 10)}`}
                      >
                        <span className="truncate font-medium">
                          {dayWidth >= 28 ? task.title : ""}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1">
          <span className="h-2 w-4 rounded bg-slate-400" /> 待办
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-4 rounded bg-amber-500" /> 进行中
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-4 rounded bg-emerald-500" /> 已完成
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-4 rounded border-2 border-rose-300 ring-1 ring-rose-200 bg-amber-500" />{" "}
          逾期
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-px bg-emerald-500" /> 今天
        </span>
      </div>
    </div>
  );
}
