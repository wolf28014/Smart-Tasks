"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Plus, Check, X, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TAG_COLORS,
  TAG_COLOR_META,
  normalizeTagName,
  normalizeTagColor,
  type TagColor,
  type TagData,
} from "@/lib/tag-utils";
import { useTags } from "@/lib/tag-context";

interface TagManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Active tasks, used to compute usage counts per tag. */
  taskCountByTag?: Record<string, number>;
}

export function TagManagerDialog({
  open,
  onOpenChange,
  taskCountByTag = {},
}: TagManagerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Only mount the inner body when open, so all local state naturally
          resets to its initial value on each open. This avoids the
          setState-in-effect lint rule. */}
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] flex flex-col">
        {open ? (
          <TagManagerBody
            taskCountByTag={taskCountByTag}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TagManagerBody({
  taskCountByTag,
  onClose,
}: {
  taskCountByTag: Record<string, number>;
  onClose: () => void;
}) {
  const { tags, loading, create, update, remove } = useTags();

  // New tag draft
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<TagColor>("emerald");

  // Editing tag id (null = not editing)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<TagColor>("emerald");

  // Delete confirmation
  const [deleteTag, setDeleteTag] = useState<TagData | null>(null);

  const sortedTags = useMemo(() => {
    // Show tags with usage first (desc), then unused tags by name asc.
    return [...tags].sort((a, b) => {
      const ca = taskCountByTag[a.name] ?? 0;
      const cb = taskCountByTag[b.name] ?? 0;
      if (ca !== cb) return cb - ca;
      return a.name.localeCompare(b.name);
    });
  }, [tags, taskCountByTag]);

  async function handleCreate() {
    const name = normalizeTagName(newName);
    if (!name) return;
    const tag = await create({ name, color: newColor });
    if (tag) {
      setNewName("");
      setNewColor("emerald");
    }
  }

  function startEdit(tag: TagData) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(normalizeTagColor(tag.color));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditColor("emerald");
  }

  async function saveEdit() {
    if (!editingId) return;
    const name = normalizeTagName(editName);
    if (!name) return;
    const updated = await update(editingId, { name, color: editColor });
    if (updated) cancelEdit();
  }

  async function handleDelete() {
    if (!deleteTag) return;
    const ok = await remove(deleteTag.id);
    if (ok) setDeleteTag(null);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>标签管理</DialogTitle>
        <DialogDescription>
          管理任务的标签颜色与命名。删除标签不会影响已使用该标签的任务。
        </DialogDescription>
      </DialogHeader>

      {/* Create new tag */}
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
        <div className="text-xs font-medium text-muted-foreground">
          新建标签
        </div>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreate();
              }
            }}
            placeholder="标签名，如：工作、学习"
            className="flex-1"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleCreate}
            disabled={!newName.trim()}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            添加
          </Button>
        </div>
        <ColorPicker value={newColor} onChange={setNewColor} />
      </div>

      {/* Existing tags list */}
      <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            加载中...
          </div>
        ) : sortedTags.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            还没有标签，先在上方创建一个吧。
          </div>
        ) : (
          sortedTags.map((tag) => {
            const isEditing = editingId === tag.id;
            const count = taskCountByTag[tag.name] ?? 0;
            const color = normalizeTagColor(tag.color);
            const meta = TAG_COLOR_META[color];

            if (isEditing) {
              return (
                <div
                  key={tag.id}
                  className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 space-y-2.5"
                >
                  <div className="flex gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveEdit();
                        } else if (e.key === "Escape") {
                          cancelEdit();
                        }
                      }}
                      placeholder="标签名"
                      className="flex-1"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={saveEdit}
                      disabled={!editName.trim()}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      保存
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={cancelEdit}
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      取消
                    </Button>
                  </div>
                  <ColorPicker value={editColor} onChange={setEditColor} />
                </div>
              );
            }

            return (
              <div
                key={tag.id}
                className="group flex items-center gap-3 rounded-lg border bg-card px-3 py-2 hover:border-foreground/15 transition-colors"
              >
                <span
                  className={cn(
                    "h-3.5 w-3.5 rounded-full shrink-0",
                    meta.dot,
                  )}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{tag.name}</span>
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-md font-medium",
                        meta.soft,
                        meta.softText,
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {count > 0
                      ? `${count} 个任务使用`
                      : "暂无任务使用"}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => startEdit(tag)}
                    aria-label="编辑"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 hover:text-rose-600"
                    onClick={() => setDeleteTag(tag)}
                    aria-label="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Hint when there are tag names in tasks that aren't in the Tag table */}
      <OrphanTagsHint taskCountByTag={taskCountByTag} />

      <DialogFooter>
        <Button onClick={onClose}>完成</Button>
      </DialogFooter>

      <AlertDialog
        open={!!deleteTag}
        onOpenChange={(o) => !o && setDeleteTag(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除标签「{deleteTag?.name}」？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后，已使用此标签的任务仍保留标签名，但失去颜色绑定。
              此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// --- Color picker ----------------------------------------------------------

function ColorPicker({
  value,
  onChange,
}: {
  value: TagColor;
  onChange: (c: TagColor) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {TAG_COLORS.map((c) => {
        const meta = TAG_COLOR_META[c];
        const active = value === c;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={meta.label}
            className={cn(
              "h-6 w-6 rounded-full flex items-center justify-center transition-transform",
              meta.dot,
              active
                ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                : "hover:scale-110",
            )}
          >
            {active && <Check className="h-3.5 w-3.5 text-white" />}
          </button>
        );
      })}
    </div>
  );
}

// --- Orphan tags hint ------------------------------------------------------
//
// If a task references a tag name that doesn't exist in the Tag table
// (e.g. user typed a new tag in the task dialog but didn't "register"
// it), we show a hint offering to create a Tag entry for it so the
// user can assign a color.

function OrphanTagsHint({
  taskCountByTag,
}: {
  taskCountByTag: Record<string, number>;
}) {
  const { tags, create } = useTags();
  const orphans = useMemo(() => {
    const known = new Set(tags.map((t) => t.name));
    return Object.keys(taskCountByTag)
      .filter((name) => !known.has(name))
      .sort();
  }, [tags, taskCountByTag]);

  if (orphans.length === 0) return null;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-2.5 text-xs">
      <div className="font-medium text-amber-800 dark:text-amber-200 mb-1.5 flex items-center gap-1.5">
        <Hash className="h-3 w-3" />
        发现 {orphans.length} 个未注册的标签
      </div>
      <div className="text-amber-700 dark:text-amber-300 mb-2">
        点击下方标签为它指定颜色，便于在分组视图中显示。
      </div>
      <div className="flex flex-wrap gap-1">
        {orphans.slice(0, 12).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => create({ name })}
            className="inline-flex items-center gap-0.5 rounded-md border border-amber-300 dark:border-amber-700 bg-background px-1.5 py-0.5 text-[11px] text-amber-800 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
          >
            <Plus className="h-2.5 w-2.5" />
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
