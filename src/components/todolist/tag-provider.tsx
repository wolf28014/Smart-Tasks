"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "@/hooks/use-toast";
import {
  normalizeTagColor,
  normalizeTagName,
  type TagData,
  type TagInput,
} from "@/lib/tag-utils";
import {
  TagContext,
  useTags,
  type TagContextValue,
} from "@/lib/tag-context";

interface TagProviderProps {
  children: ReactNode;
}

export function TagProvider({ children }: TagProviderProps) {
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/tags", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[TagProvider] failed to load tags:", err);
        return;
      }
      const data = await res.json();
      setTags(data.tags ?? []);
    } catch (err) {
      console.error("[TagProvider] network error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const tagMap = useMemo(() => {
    const m = new Map<string, TagData>();
    for (const t of tags) m.set(t.name, t);
    return m;
  }, [tags]);

  const getByName = useCallback(
    (name: string): TagData | null => {
      const n = normalizeTagName(name);
      return tagMap.get(n) ?? null;
    },
    [tagMap],
  );

  const colorFor = useCallback(
    (name: string) => {
      const t = tagMap.get(normalizeTagName(name));
      return t ? normalizeTagColor(t.color) : "emerald";
    },
    [tagMap],
  );

  const create = useCallback(
    async (input: TagInput): Promise<TagData | null> => {
      const name = normalizeTagName(input.name);
      if (!name) {
        toast({ title: "标签名不能为空", variant: "destructive" });
        return null;
      }
      try {
        const res = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, color: input.color ?? "emerald" }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "创建失败");
        }
        const { tag } = await res.json();
        setTags((prev) => {
          // Replace any existing tag with the same name, otherwise prepend.
          const filtered = prev.filter((t) => t.name !== tag.name);
          return [tag, ...filtered];
        });
        toast({ title: "标签已创建", description: tag.name });
        return tag as TagData;
      } catch (err) {
        toast({
          title: "创建标签失败",
          description: err instanceof Error ? err.message : "未知错误",
          variant: "destructive",
        });
        return null;
      }
    },
    [],
  );

  const update = useCallback(
    async (id: string, input: Partial<TagInput>): Promise<TagData | null> => {
      try {
        const body: Record<string, string> = {};
        if (input.name !== undefined) body.name = normalizeTagName(input.name);
        if (input.color !== undefined) body.color = input.color;
        const res = await fetch(`/api/tags/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "更新失败");
        }
        const { tag } = await res.json();
        setTags((prev) => prev.map((t) => (t.id === id ? tag : t)));
        toast({ title: "标签已更新", description: tag.name });
        return tag as TagData;
      } catch (err) {
        toast({
          title: "更新标签失败",
          description: err instanceof Error ? err.message : "未知错误",
          variant: "destructive",
        });
        return null;
      }
    },
    [],
  );

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "删除失败");
      }
      setTags((prev) => prev.filter((t) => t.id !== id));
      toast({ title: "标签已删除" });
      return true;
    } catch (err) {
      toast({
        title: "删除标签失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
      return false;
    }
  }, []);

  const value: TagContextValue = {
    tags,
    loading,
    tagMap,
    getByName,
    colorFor,
    reload,
    create,
    update,
    remove,
  };

  return <TagContext.Provider value={value}>{children}</TagContext.Provider>;
}

// Re-export so consumers can `import { useTags } from "@/components/todolist/tag-provider"`
// instead of having to know the context lives in lib/tag-context.
export { useTags } from "@/lib/tag-context";
