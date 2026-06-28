"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDot,
  Clock,
  AlertTriangle,
  CalendarClock,
  Timer,
  ListTodo,
  XCircle,
  Tag as TagIcon,
  Flame,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
  ComposedChart,
  Line,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  PRIORITY_META,
  STATUS_META,
  type TaskData,
} from "@/lib/task-utils";

interface DashboardViewProps {
  tasks: TaskData[];
}

interface PomodoroSeriesPoint {
  date: string;
  label: string;
  count: number;
  minutes: number;
}

interface PomodoroStats {
  series: PomodoroSeriesPoint[];
  total: number;
  totalMinutes: number;
  days: number;
}

const STATUS_COLORS: Record<string, string> = {
  todo: "#94a3b8",
  in_progress: "#f59e0b",
  done: "#10b981",
  cancelled: "#f43f5e",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "#f43f5e",
  medium: "#f59e0b",
  low: "#94a3b8",
};

export function DashboardView({ tasks }: DashboardViewProps) {
  const [pomodoro, setPomodoro] = useState<PomodoroStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pomodoro/sessions?days=14")
      .then((r) => r.json())
      .then((data: PomodoroStats) => {
        if (!cancelled) setPomodoro(data);
      })
      .catch(() => {
        if (!cancelled)
          setPomodoro({
            series: [],
            total: 0,
            totalMinutes: 0,
            days: 14,
          });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const byStatus: Record<string, number> = {
      todo: 0,
      in_progress: 0,
      done: 0,
      cancelled: 0,
    };
    const byPriority: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
    };
    let overdue = 0;
    let dueToday = 0;
    let subtaskTotal = 0;
    let subtaskDone = 0;
    let pomodoros = 0;
    const tagCounts: Record<string, number> = {};

    // 14-day trend
    const trend: { date: string; label: string; done: number; created: number }[] =
      [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      trend.push({
        date: key,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        done: 0,
        created: 0,
      });
    }
    const trendIndex = new Map(trend.map((t, i) => [t.date, i]));

    for (const t of tasks) {
      byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
      byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
      for (const tag of t.tags) {
        tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      }
      subtaskTotal += t.subtasks.length;
      subtaskDone += t.subtasks.filter((s) => s.done).length;
      pomodoros += t.pomodoros;
      if (
        t.dueDate &&
        t.dueDate < today &&
        t.status !== "done" &&
        t.status !== "cancelled"
      ) {
        overdue++;
      }
      if (t.dueDate === today) dueToday++;
      const cdate = t.createdAt.slice(0, 10);
      const ci = trendIndex.get(cdate);
      if (ci !== undefined) trend[ci].created++;
      if (t.completedAt) {
        const ddate = t.completedAt.slice(0, 10);
        const di = trendIndex.get(ddate);
        if (di !== undefined) trend[di].done++;
      }
    }

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    const completionRate =
      tasks.length === 0
        ? 0
        : Math.round((byStatus.done / tasks.length) * 100);

    return {
      total: tasks.length,
      byStatus,
      byPriority,
      overdue,
      dueToday,
      subtaskTotal,
      subtaskDone,
      pomodoros,
      topTags,
      trend,
      completionRate,
    };
  }, [tasks]);

  const statusData = Object.entries(stats.byStatus).map(([k, v]) => ({
    name: STATUS_META[k as keyof typeof STATUS_META]?.label ?? k,
    value: v,
    key: k,
  }));
  const priorityData = Object.entries(stats.byPriority).map(([k, v]) => ({
    name: PRIORITY_META[k as keyof typeof PRIORITY_META]?.label ?? k,
    value: v,
    key: k,
  }));

  const cards = [
    {
      label: "任务总数",
      value: stats.total,
      icon: ListTodo,
      color: "text-slate-600 dark:text-slate-300",
      bg: "bg-slate-100 dark:bg-slate-800",
    },
    {
      label: "进行中",
      value: stats.byStatus.in_progress,
      icon: CircleDot,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-100 dark:bg-amber-950/40",
    },
    {
      label: "已完成",
      value: stats.byStatus.done,
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-950/40",
    },
    {
      label: "已取消",
      value: stats.byStatus.cancelled,
      icon: XCircle,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-100 dark:bg-rose-950/40",
    },
    {
      label: "今日到期",
      value: stats.dueToday,
      icon: CalendarClock,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-100 dark:bg-violet-950/40",
    },
    {
      label: "已逾期",
      value: stats.overdue,
      icon: AlertTriangle,
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-100 dark:bg-rose-950/40",
    },
    {
      label: "番茄钟",
      value: stats.pomodoros,
      icon: Timer,
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-100 dark:bg-orange-950/40",
    },
    {
      label: "完成率",
      value: `${stats.completionRate}%`,
      icon: Clock,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-100 dark:bg-emerald-950/40",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border bg-card p-4 flex items-center gap-3"
          >
            <div className={cn("rounded-lg p-2.5", c.bg)}>
              <c.icon className={cn("h-5 w-5", c.color)} />
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">
                {c.value}
              </div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend area chart */}
        <div className="lg:col-span-2 rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold">近 14 天任务趋势</h3>
              <p className="text-xs text-muted-foreground">
                每日新建与完成的任务数量
              </p>
            </div>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trend}>
                <defs>
                  <linearGradient id="gDone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid rgba(120,120,120,0.2)",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="created"
                  name="新建"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#gCreated)"
                />
                <Area
                  type="monotone"
                  dataKey="done"
                  name="完成"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#gDone)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status pie */}
        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-semibold mb-1">状态分布</h3>
          <p className="text-xs text-muted-foreground mb-2">
            各状态任务数量占比
          </p>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {statusData.map((entry) => (
                    <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid rgba(120,120,120,0.2)",
                    fontSize: 12,
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  iconType="circle"
                  iconSize={8}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom row: priority + tags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-semibold mb-1">优先级分布</h3>
          <p className="text-xs text-muted-foreground mb-3">
            高 / 中 / 低优先级任务数量
          </p>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <Tooltip
                  cursor={{ fill: "rgba(120,120,120,0.05)" }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid rgba(120,120,120,0.2)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="value" name="任务数" radius={[6, 6, 0, 0]}>
                  {priorityData.map((entry) => (
                    <Cell key={entry.key} fill={PRIORITY_COLORS[entry.key]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-semibold mb-1 flex items-center gap-2">
            <TagIcon className="h-4 w-4" />
            热门标签
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            使用频次最高的标签
          </p>
          {stats.topTags.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
              暂无标签
            </div>
          ) : (
            <div className="space-y-2.5">
              {stats.topTags.map((tag) => {
                const max = stats.topTags[0].count || 1;
                const pct = Math.round((tag.count / max) * 100);
                return (
                  <div key={tag.name} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-20 truncate">
                      #{tag.name}
                    </span>
                    <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right tabular-nums">
                      {tag.count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pomodoro history */}
      {pomodoro && (
        <div className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                番茄钟历史
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                近 {pomodoro.days} 天的专注记录
              </p>
            </div>
            <div className="flex gap-4 text-right">
              <div>
                <div className="text-2xl font-bold tabular-nums text-orange-600 dark:text-orange-400">
                  {pomodoro.total}
                </div>
                <div className="text-xs text-muted-foreground">总番茄钟</div>
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">
                  {pomodoro.totalMinutes}
                </div>
                <div className="text-xs text-muted-foreground">总分钟数</div>
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">
                  {Math.round(pomodoro.total / Math.max(1, pomodoro.days) * 10) / 10}
                </div>
                <div className="text-xs text-muted-foreground">日均</div>
              </div>
            </div>
          </div>
          <div className="h-[240px]">
            {pomodoro.series.length === 0 || pomodoro.total === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                近 14 天还没有番茄钟记录，点击任务卡片的 ▶ 按钮开始专注
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={pomodoro.series}>
                  <defs>
                    <linearGradient id="gPomodoro" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={28}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    allowDecimals={false}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    tickFormatter={(v) => `${v}m`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid rgba(120,120,120,0.2)",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    yAxisId="left"
                    dataKey="count"
                    name="番茄钟数"
                    fill="#f97316"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="minutes"
                    name="专注分钟"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#10b981" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* Subtask progress */}
      {stats.subtaskTotal > 0 && (
        <div className="rounded-xl border bg-card p-5">
          <h3 className="font-semibold mb-3">子任务进度</h3>
          <div className="flex items-center gap-4">
            <div className="text-3xl font-semibold tabular-nums">
              {stats.subtaskDone}
              <span className="text-muted-foreground text-base">
                {" "}
                / {stats.subtaskTotal}
              </span>
            </div>
            <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{
                  width: `${Math.round(
                    (stats.subtaskDone / stats.subtaskTotal) * 100,
                  )}%`,
                }}
              />
            </div>
            <span className="text-sm font-medium tabular-nums">
              {Math.round((stats.subtaskDone / stats.subtaskTotal) * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
