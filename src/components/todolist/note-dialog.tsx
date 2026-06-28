"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileText, Eye, Pencil, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface NoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskTitle: string;
  note: string | null;
  onSave: (markdown: string | null) => Promise<void>;
  /** All tasks, used to suggest link targets in the wikilink autocomplete. */
  allTaskTitles?: string[];
  currentTaskId?: string;
}

export function NoteDialog({
  open,
  onOpenChange,
  taskTitle,
  note,
  onSave,
  allTaskTitles = [],
  currentTaskId,
}: NoteDialogProps) {
  const [draft, setDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [tab, setTab] = React.useState<"edit" | "preview">("edit");

  // Wikilink autocomplete state
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [wikiQuery, setWikiQuery] = React.useState<{
    start: number;
    end: number;
    text: string;
  } | null>(null);

  React.useEffect(() => {
    if (open) {
      setDraft(note ?? "");
      setTab("edit");
    }
  }, [open, note]);

  // Detect [[query pattern at cursor position
  function handleDraftChange(value: string) {
    setDraft(value);
    const el = textareaRef.current;
    if (!el) return;
    const cursor = el.selectionStart;
    // Find the most recent `[[` before the cursor that has no matching `]]`
    const before = value.slice(0, cursor);
    const lastOpen = before.lastIndexOf("[[");
    if (lastOpen === -1) {
      setWikiQuery(null);
      return;
    }
    const afterOpen = before.slice(lastOpen + 2);
    if (afterOpen.includes("]]") || afterOpen.includes("\n")) {
      setWikiQuery(null);
      return;
    }
    setWikiQuery({
      start: lastOpen,
      end: cursor,
      text: afterOpen,
    });
  }

  function insertWikiLink(target: string) {
    if (!wikiQuery) return;
    const before = draft.slice(0, wikiQuery.start);
    const after = draft.slice(wikiQuery.end);
    const insertion = `[[${target}]]`;
    const next = before + insertion + after;
    setDraft(next);
    setWikiQuery(null);
    // Restore focus and place cursor after the inserted link
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      const pos = (before + insertion).length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  const suggestions = React.useMemo(() => {
    if (!wikiQuery || wikiQuery.text.length < 1) return [];
    const q = wikiQuery.text.toLowerCase();
    return allTaskTitles
      .filter((t) => t.toLowerCase().includes(q) && t !== taskTitle)
      .slice(0, 6);
  }, [wikiQuery, allTaskTitles, taskTitle]);

  async function handleSave() {
    setSaving(true);
    try {
      const trimmed = draft.trim();
      await onSave(trimmed.length > 0 ? trimmed : null);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setSaving(true);
    try {
      await onSave(null);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-emerald-500" />
            Markdown 笔记
          </DialogTitle>
          <DialogDescription className="truncate">
            关联任务：{taskTitle}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "edit" | "preview")}
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="self-start">
            <TabsTrigger value="edit">
              <Pencil className="h-3 w-3 mr-1" />
              编辑
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-3 w-3 mr-1" />
              预览
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="edit"
            className="flex-1 min-h-0 mt-2 data-[state=inactive]:hidden relative"
          >
            <Textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
              onBlur={() => setTimeout(() => setWikiQuery(null), 200)}
              placeholder="支持完整 Markdown 语法…&#10;&#10;# 标题&#10;**粗体** *斜体* ~~删除线~~&#10;&#10;- 列表项 1&#10;- 列表项 2&#10;&#10;[链接](https://example.com)&#10;&#10;```python&#10;print('hello')&#10;```&#10;&#10;笔记关联：[[另一个任务的标题]]"
              className="h-[420px] resize-none font-mono text-sm leading-relaxed"
            />
            {/* Wikilink autocomplete popup */}
            {wikiQuery && suggestions.length > 0 && (
              <div className="absolute z-10 bottom-3 left-3 right-3 max-h-32 overflow-y-auto rounded-md border bg-popover shadow-lg">
                <div className="px-2 py-1 text-[10px] text-muted-foreground border-b sticky top-0 bg-popover flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  链接到任务（{suggestions.length} 项匹配）
                </div>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="block w-full text-left px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertWikiLink(s);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              提示：输入{" "}
              <code className="px-1 py-0.5 rounded bg-muted">
                [[任务标题]]
              </code>{" "}
              可建立到其他任务的关联（双向笔记图谱）
            </p>
          </TabsContent>

          <TabsContent
            value="preview"
            className={cn(
              "flex-1 min-h-0 mt-2 overflow-y-auto rounded-md border bg-muted/20 p-4",
              "prose prose-sm dark:prose-invert max-w-none",
              "[&_pre]:bg-zinc-900 [&_pre]:text-zinc-100 [&_pre]:rounded-md [&_pre]:p-3 [&_pre]:text-xs",
              "[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono",
              "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
              "[&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
              "[&_blockquote]:border-l-4 [&_blockquote]:border-emerald-400 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
            )}
          >
            {draft.trim() ? (
              <ReactMarkdown>{draft}</ReactMarkdown>
            ) : (
              <p className="text-muted-foreground text-sm">
                还没有内容，切换到「编辑」标签开始写吧。
              </p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2">
          {note && (
            <Button
              variant="ghost"
              onClick={handleClear}
              disabled={saving}
              className="mr-auto text-rose-600 hover:text-rose-700"
            >
              清除笔记
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存笔记"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
