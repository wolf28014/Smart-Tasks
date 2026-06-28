"use client";

import { useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { useState } from "react";
import {
  STATUSES,
  STATUS_META,
  type Status,
  type TaskData,
} from "@/lib/task-utils";
import { cn } from "@/lib/utils";
import { TaskCard } from "./task-card";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface KanbanViewProps {
  tasks: TaskData[];
  onStatusChange: (taskId: string, status: Status) => void;
  onEdit: (task: TaskData) => void;
  onToggleDone: (task: TaskData) => void;
  onDelete: (id: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onStartPomodoro: (task: TaskData) => void;
  onOpenNote: (task: TaskData) => void;
  onAskAI?: (task: TaskData) => void;
  onNew: () => void;
}

export function KanbanView(props: KanbanViewProps) {
  const { tasks, onStatusChange } = props;
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const columns = useMemo(() => {
    const map: Record<Status, TaskData[]> = {
      todo: [],
      in_progress: [],
      done: [],
      cancelled: [],
    };
    for (const t of tasks) {
      map[t.status]?.push(t);
    }
    // Sort within column by priority then due date
    const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    for (const k of Object.keys(map) as Status[]) {
      map[k].sort(
        (a, b) =>
          (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9) ||
          (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
      );
    }
    return map;
  }, [tasks]);

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const newStatus = over.id as Status;
    const taskId = String(active.id);
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;
    onStatusChange(taskId, newStatus);
  }

  const activeTask = tasks.find((t) => t.id === activeId) ?? null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={columns[status]}
            onEdit={props.onEdit}
            onToggleDone={props.onToggleDone}
            onDelete={props.onDelete}
            onToggleSubtask={props.onToggleSubtask}
            onStartPomodoro={props.onStartPomodoro}
            onOpenNote={props.onOpenNote}
            onAskAI={props.onAskAI}
            onNew={props.onNew}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
        {activeTask ? (
          <div className="rotate-3 opacity-90 cursor-grabbing">
            <TaskCard
              task={activeTask}
              onEdit={() => {}}
              onToggleDone={() => {}}
              onDelete={() => {}}
              onToggleSubtask={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  tasks,
  onEdit,
  onToggleDone,
  onDelete,
  onToggleSubtask,
  onStartPomodoro,
  onOpenNote,
  onAskAI,
  onNew,
}: {
  status: Status;
  tasks: TaskData[];
  onEdit: (task: TaskData) => void;
  onToggleDone: (task: TaskData) => void;
  onDelete: (id: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onStartPomodoro: (task: TaskData) => void;
  onOpenNote: (task: TaskData) => void;
  onAskAI?: (task: TaskData) => void;
  onNew: () => void;
}) {
  const meta = STATUS_META[status];
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col">
      {/* Column header — large color-block banner similar to the list view
          group header. Uses status color for instant visual scanning. */}
      <div
        className={cn(
          "mb-3 flex items-center gap-2.5 rounded-xl border px-3 py-2.5",
          meta.bg,
          "border-border/60",
        )}
      >
        <span
          className={cn(
            "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm",
            meta.dot,
          )}
          aria-hidden
        >
          <span className="h-2.5 w-2.5 rounded-full bg-white/90" />
        </span>
        <h3
          className={cn(
            "text-base font-semibold tracking-tight",
            meta.color,
          )}
        >
          {meta.label}
        </h3>
        <span
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full tabular-nums",
            "bg-background/70 text-foreground/70",
          )}
        >
          {tasks.length}
        </span>
        <div className="ml-auto flex items-center">
          {status === "todo" && (
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-7 w-7",
                meta.color,
                "hover:bg-black/5 dark:hover:bg-white/10",
              )}
              onClick={onNew}
              aria-label="新建任务"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 min-h-[200px] rounded-xl border border-dashed p-2 space-y-2 transition-colors",
          isOver
            ? "border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20"
            : "border-border bg-muted/30",
        )}
      >
        {tasks.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground">
            拖拽任务到此
          </div>
        ) : (
          tasks.map((task) => (
            <DraggableTaskCard
              key={task.id}
              task={task}
              onEdit={onEdit}
              onToggleDone={onToggleDone}
              onDelete={onDelete}
              onToggleSubtask={onToggleSubtask}
              onStartPomodoro={onStartPomodoro}
              onOpenNote={onOpenNote}
              onAskAI={onAskAI}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableTaskCard({
  task,
  onEdit,
  onToggleDone,
  onDelete,
  onToggleSubtask,
  onStartPomodoro,
  onOpenNote,
  onAskAI,
}: {
  task: TaskData;
  onEdit: (task: TaskData) => void;
  onToggleDone: (task: TaskData) => void;
  onDelete: (id: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onStartPomodoro: (task: TaskData) => void;
  onOpenNote: (task: TaskData) => void;
  onAskAI?: (task: TaskData) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "cursor-grab active:cursor-grabbing touch-none",
        isDragging && "opacity-30",
      )}
      onClick={(e) => {
        // Prevent drag handler from swallowing edit clicks
        const target = e.target as HTMLElement;
        if (target.closest("button, input, [role='checkbox'], a")) {
          e.stopPropagation();
        }
      }}
    >
      <TaskCard
        task={task}
        onEdit={onEdit}
        onToggleDone={onToggleDone}
        onDelete={onDelete}
        onToggleSubtask={onToggleSubtask}
        onStartPomodoro={onStartPomodoro}
        onOpenNote={onOpenNote}
        onAskAI={onAskAI}
      />
    </div>
  );
}
