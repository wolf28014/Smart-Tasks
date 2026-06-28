// Shared constants and helpers for the Tag system.
// This file is imported by BOTH server (API routes) and client
// (components), so it must NOT contain any React APIs (no createContext,
// no useContext, no hooks) and must NOT have a "use client" directive.

// --- Tag color palette -----------------------------------------------------

export const TAG_COLORS = [
  "emerald",
  "teal",
  "sky",
  "violet",
  "amber",
  "orange",
  "rose",
  "slate",
] as const;

export type TagColor = (typeof TAG_COLORS)[number];

export const TAG_COLOR_META: Record<
  TagColor,
  {
    label: string;
    // Tailwind classes for solid dot/swatch
    dot: string;
    // Tailwind classes for the "soft" badge background (used in tag pills)
    soft: string;
    softText: string;
    softBorder: string;
    // Strong banner background (used in group header)
    bannerBg: string;
    bannerText: string;
    // Raw hex for inline styling (used in canvas/SVG contexts)
    hex: string;
  }
> = {
  emerald: {
    label: "翡翠绿",
    dot: "bg-emerald-500",
    soft: "bg-emerald-100 dark:bg-emerald-950/40",
    softText: "text-emerald-700 dark:text-emerald-300",
    softBorder: "border-emerald-200 dark:border-emerald-800",
    bannerBg: "bg-emerald-50 dark:bg-emerald-950/40",
    bannerText: "text-emerald-700 dark:text-emerald-300",
    hex: "#10b981",
  },
  teal: {
    label: "青蓝",
    dot: "bg-teal-500",
    soft: "bg-teal-100 dark:bg-teal-950/40",
    softText: "text-teal-700 dark:text-teal-300",
    softBorder: "border-teal-200 dark:border-teal-800",
    bannerBg: "bg-teal-50 dark:bg-teal-950/40",
    bannerText: "text-teal-700 dark:text-teal-300",
    hex: "#14b8a6",
  },
  sky: {
    label: "天蓝",
    dot: "bg-sky-500",
    soft: "bg-sky-100 dark:bg-sky-950/40",
    softText: "text-sky-700 dark:text-sky-300",
    softBorder: "border-sky-200 dark:border-sky-800",
    bannerBg: "bg-sky-50 dark:bg-sky-950/40",
    bannerText: "text-sky-700 dark:text-sky-300",
    hex: "#0ea5e9",
  },
  violet: {
    label: "紫罗兰",
    dot: "bg-violet-500",
    soft: "bg-violet-100 dark:bg-violet-950/40",
    softText: "text-violet-700 dark:text-violet-300",
    softBorder: "border-violet-200 dark:border-violet-800",
    bannerBg: "bg-violet-50 dark:bg-violet-950/40",
    bannerText: "text-violet-700 dark:text-violet-300",
    hex: "#8b5cf6",
  },
  amber: {
    label: "琥珀",
    dot: "bg-amber-500",
    soft: "bg-amber-100 dark:bg-amber-950/40",
    softText: "text-amber-700 dark:text-amber-300",
    softBorder: "border-amber-200 dark:border-amber-800",
    bannerBg: "bg-amber-50 dark:bg-amber-950/40",
    bannerText: "text-amber-700 dark:text-amber-300",
    hex: "#f59e0b",
  },
  orange: {
    label: "橙",
    dot: "bg-orange-500",
    soft: "bg-orange-100 dark:bg-orange-950/40",
    softText: "text-orange-700 dark:text-orange-300",
    softBorder: "border-orange-200 dark:border-orange-800",
    bannerBg: "bg-orange-50 dark:bg-orange-950/40",
    bannerText: "text-orange-700 dark:text-orange-300",
    hex: "#f97316",
  },
  rose: {
    label: "玫瑰红",
    dot: "bg-rose-500",
    soft: "bg-rose-100 dark:bg-rose-950/40",
    softText: "text-rose-700 dark:text-rose-300",
    softBorder: "border-rose-200 dark:border-rose-800",
    bannerBg: "bg-rose-50 dark:bg-rose-950/40",
    bannerText: "text-rose-700 dark:text-rose-300",
    hex: "#f43f5e",
  },
  slate: {
    label: "灰",
    dot: "bg-slate-400",
    soft: "bg-slate-100 dark:bg-slate-800",
    softText: "text-slate-700 dark:text-slate-300",
    softBorder: "border-slate-200 dark:border-slate-700",
    bannerBg: "bg-slate-50 dark:bg-slate-800/40",
    bannerText: "text-slate-700 dark:text-slate-300",
    hex: "#94a3b8",
  },
};

// --- Types -----------------------------------------------------------------

export interface TagData {
  id: string;
  name: string;
  color: TagColor;
  createdAt: string;
  updatedAt: string;
}

export interface TagInput {
  name: string;
  color?: TagColor;
}

// --- Color helpers ---------------------------------------------------------

export function normalizeTagColor(color: string | null | undefined): TagColor {
  if (color && (TAG_COLORS as readonly string[]).includes(color)) {
    return color as TagColor;
  }
  return "emerald";
}

// Strip leading '#', trim whitespace.
export function normalizeTagName(name: string): string {
  return name.trim().replace(/^#/, "");
}
