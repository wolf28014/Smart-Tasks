"use client";

// Client-only Tag context and hooks.
// This file imports React APIs (createContext, useContext), so it must
// only be imported from client components.

import { createContext, useContext } from "react";
import type { TagColor, TagData, TagInput } from "@/lib/tag-utils";

export interface TagContextValue {
  tags: TagData[];
  loading: boolean;
  /** Map from tag name → TagData for O(1) lookup. */
  tagMap: Map<string, TagData>;
  /** Get TagData by name, returning null if not found. */
  getByName: (name: string) => TagData | null;
  /** Get color for a tag name (defaults to emerald). */
  colorFor: (name: string) => TagColor;
  reload: () => Promise<void>;
  create: (input: TagInput) => Promise<TagData | null>;
  update: (id: string, input: Partial<TagInput>) => Promise<TagData | null>;
  remove: (id: string) => Promise<boolean>;
}

export const TagContext = createContext<TagContextValue | null>(null);

export function useTags(): TagContextValue {
  const ctx = useContext(TagContext);
  if (!ctx) {
    throw new Error("useTags must be used within a TagProvider");
  }
  return ctx;
}

// Optional variant for components that want to gracefully handle the
// case where no provider is mounted (e.g. legacy components during the
// migration period, or components used outside the main app shell).
export function useTagsOptional(): TagContextValue | null {
  return useContext(TagContext);
}
