"use client";

import * as React from "react";
import { Network, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  resolveBacklinks,
  STATUS_META,
  type Status,
  type TaskData,
} from "@/lib/task-utils";

interface NotesGraphViewProps {
  tasks: TaskData[];
  onOpenNote: (task: TaskData) => void;
}

interface SimNode {
  id: string;
  title: string;
  status: Status;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hasNote: boolean;
  incoming: number;
  outgoing: number;
}

interface SimEdge {
  source: string;
  target: string;
}

const NODE_R = 22;
const WIDTH = 1000;
const HEIGHT = 600;
const REPULSION = 12000;
const SPRING = 0.04;
const SPRING_LENGTH = 140;
const CENTER_PULL = 0.005;
const DAMPING = 0.85;

export function NotesGraphView({ tasks, onOpenNote }: NotesGraphViewProps) {
  const svgRef = React.useRef<SVGSVGElement>(null);
  const [hoverId, setHoverId] = React.useState<string | null>(null);

  // Build nodes & edges from backlinks
  const { nodes, edges } = React.useMemo(() => {
    const tasksWithNotes = tasks.filter((t) => t.noteMarkdown || t.deletedAt === null);
    const { outgoing } = resolveBacklinks(tasksWithNotes);
    const incoming: Record<string, number> = {};
    const outgoingCount: Record<string, number> = {};
    const edgeSet = new Set<string>();
    const edges: SimEdge[] = [];
    for (const [src, targets] of Object.entries(outgoing)) {
      outgoingCount[src] = targets.length;
      for (const tgt of targets) {
        incoming[tgt] = (incoming[tgt] ?? 0) + 1;
        const key = `${src}->${tgt}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({ source: src, target: tgt });
        }
      }
    }
    // Only include tasks that have notes OR participate in links
    const linkedIds = new Set<string>();
    for (const e of edges) {
      linkedIds.add(e.source);
      linkedIds.add(e.target);
    }
    const nodes: SimNode[] = tasksWithNotes
      .filter((t) => t.noteMarkdown || linkedIds.has(t.id))
      .map((t, i) => {
        // Random initial position in a circle
        const angle = (i / Math.max(1, tasksWithNotes.length)) * 2 * Math.PI;
        const radius = 180 + Math.random() * 60;
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          x: WIDTH / 2 + Math.cos(angle) * radius,
          y: HEIGHT / 2 + Math.sin(angle) * radius,
          vx: 0,
          vy: 0,
          hasNote: !!t.noteMarkdown,
          incoming: incoming[t.id] ?? 0,
          outgoing: outgoingCount[t.id] ?? 0,
        };
      });
    return { nodes, edges };
  }, [tasks]);

  // Force simulation with rAF
  const nodesRef = React.useRef<SimNode[]>([]);
  React.useEffect(() => {
    nodesRef.current = nodes.map((n) => ({ ...n }));
  }, [nodes]);

  const [, forceRender] = React.useReducer((x) => x + 1, 0);

  React.useEffect(() => {
    let raf = 0;
    let mounted = true;

    function step() {
      if (!mounted) return;
      const ns = nodesRef.current;
      if (ns.length === 0) {
        raf = requestAnimationFrame(step);
        return;
      }

      // Repulsion between all pairs
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const a = ns[i];
          const b = ns[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distSq = Math.max(100, dx * dx + dy * dy);
          const force = REPULSION / distSq;
          const dist = Math.sqrt(distSq);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      // Spring along edges
      for (const e of edges) {
        const a = ns.find((n) => n.id === e.source);
        const b = ns.find((n) => n.id === e.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = SPRING * (dist - SPRING_LENGTH);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      // Center pull + integrate + clamp
      for (const n of ns) {
        n.vx += (WIDTH / 2 - n.x) * CENTER_PULL;
        n.vy += (HEIGHT / 2 - n.y) * CENTER_PULL;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(NODE_R + 8, Math.min(WIDTH - NODE_R - 8, n.x));
        n.y = Math.max(NODE_R + 8, Math.min(HEIGHT - NODE_R - 8, n.y));
      }

      forceRender();
      raf = requestAnimationFrame(step);
    }

    raf = requestAnimationFrame(step);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf);
    };
  }, [edges]);

  const taskById = React.useMemo(
    () => new Map(tasks.map((t) => [t.id, t])),
    [tasks],
  );

  function handleNodeClick(id: string) {
    const task = taskById.get(id);
    if (task) onOpenNote(task);
  }

  const currentNodes = nodesRef.current;

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Network className="h-5 w-5 text-emerald-500" />
            笔记图谱
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            通过 Markdown 笔记中的{" "}
            <code className="px-1 py-0.5 rounded bg-muted text-emerald-700 dark:text-emerald-300">
              [[任务标题]]
            </code>{" "}
            语法建立任务间的关联。点击节点查看 / 编辑笔记。
          </p>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Info className="h-3.5 w-3.5" />
          <span>{currentNodes.length} 个节点 · {edges.length} 条关联</span>
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        {currentNodes.length === 0 ? (
          <div className="py-20 text-center">
            <Network className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-medium">还没有笔记关联</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              在任务的 Markdown 笔记中使用{" "}
              <code className="px-1 py-0.5 rounded bg-muted">
                [[另一个任务的标题]]
              </code>{" "}
              即可在两个任务之间建立关联，关联会在此图谱中可视化展示。
            </p>
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full h-[600px]"
          >
            {/* Edges */}
            <g>
              {edges.map((e, i) => {
                const a = currentNodes.find((n) => n.id === e.source);
                const b = currentNodes.find((n) => n.id === e.target);
                if (!a || !b) return null;
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2;
                return (
                  <g key={i}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="currentColor"
                      strokeOpacity={0.2}
                      strokeWidth={1.5}
                      className="text-emerald-500"
                    />
                    <polygon
                      points={`${b.x},${b.y} ${b.x - 6},${b.y - 4} ${b.x - 6},${b.y + 4}`}
                      fill="currentColor"
                      className="text-emerald-500/40"
                      transform={`rotate(${(Math.atan2(b.y - my, b.x - mx) * 180) / Math.PI}, ${b.x}, ${b.y})`}
                      style={{
                        // offset arrow to be just before node edge
                        transformOrigin: `${b.x}px ${b.y}px`,
                        transform: `translate(${-NODE_R * 0.9 * Math.cos(Math.atan2(b.y - a.y, b.x - a.x))}px, ${-NODE_R * 0.9 * Math.sin(Math.atan2(b.y - a.y, b.x - a.x))}) rotate(${(Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI}deg)`,
                      }}
                    />
                  </g>
                );
              })}
            </g>

            {/* Nodes */}
            <g>
              {currentNodes.map((n) => {
                const isHover = hoverId === n.id;
                const meta = STATUS_META[n.status];
                const isDim = hoverId && !isHover && !edges.some(
                  (e) =>
                    (e.source === hoverId && e.target === n.id) ||
                    (e.target === hoverId && e.source === n.id),
                );
                return (
                  <g
                    key={n.id}
                    transform={`translate(${n.x}, ${n.y})`}
                    onClick={() => handleNodeClick(n.id)}
                    onMouseEnter={() => setHoverId(n.id)}
                    onMouseLeave={() => setHoverId(null)}
                    className="cursor-pointer"
                    style={{ opacity: isDim ? 0.3 : 1, transition: "opacity 0.2s" }}
                  >
                    {/* Glow ring for hovered / linked nodes */}
                    {isHover && (
                      <circle
                        r={NODE_R + 6}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        className="text-emerald-400"
                        strokeOpacity={0.5}
                      />
                    )}
                    <circle
                      r={NODE_R}
                      className={cn(
                        "transition-all",
                        n.hasNote
                          ? "fill-emerald-500"
                          : "fill-muted-foreground/30",
                      )}
                      stroke={meta.dot.replace("bg-", "")}
                      strokeWidth={2}
                    />
                    {/* Status dot center */}
                    <circle r={5} className={meta.dot} />
                    {/* Title (truncated) */}
                    <text
                      y={NODE_R + 14}
                      textAnchor="middle"
                      className="text-[11px] fill-foreground pointer-events-none"
                      style={{ fontWeight: isHover ? 600 : 400 }}
                    >
                      {n.title.length > 12
                        ? n.title.slice(0, 11) + "…"
                        : n.title}
                    </text>
                    {/* Backlink count badge */}
                    {(n.incoming > 0 || n.outgoing > 0) && (
                      <g>
                        <circle
                          cx={NODE_R - 4}
                          cy={-NODE_R + 4}
                          r={9}
                          className="fill-amber-500"
                        />
                        <text
                          x={NODE_R - 4}
                          y={-NODE_R + 4}
                          dy="0.32em"
                          textAnchor="middle"
                          className="text-[10px] fill-white font-bold pointer-events-none"
                        >
                          {n.incoming + n.outgoing}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-emerald-500" /> 有笔记
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-muted-foreground/30" /> 仅链接
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-amber-500 text-white text-[9px] flex items-center justify-center font-bold">
            N
          </span>{" "}
          关联数（入+出）
        </span>
      </div>
    </div>
  );
}
