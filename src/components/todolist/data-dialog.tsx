"use client";

import * as React from "react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, Upload, FileJson, FileSpreadsheet, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface DataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function DataDialog({ open, onOpenChange, onChanged }: DataDialogProps) {
  const [importing, setImporting] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  function downloadBlob(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function exportJson() {
    try {
      const res = await fetch("/api/tasks/export?format=json");
      const text = await res.text();
      downloadBlob(
        text,
        `todolist-${new Date().toISOString().slice(0, 10)}.json`,
        "application/json",
      );
      toast({ title: "导出成功", description: "JSON 文件已开始下载" });
    } catch {
      toast({ title: "导出失败", variant: "destructive" });
    }
  }

  async function exportCsv() {
    try {
      const res = await fetch("/api/tasks/export?format=csv");
      const text = await res.text();
      // Prepend BOM for Excel CJK compatibility
      downloadBlob(
        "\uFEFF" + text,
        `todolist-${new Date().toISOString().slice(0, 10)}.csv`,
        "text/csv;charset=utf-8",
      );
      toast({ title: "导出成功", description: "CSV 文件已开始下载" });
    } catch {
      toast({ title: "导出失败", variant: "destructive" });
    }
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setImporting(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/tasks/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "导入失败");
      }
      const result = await res.json();
      toast({
        title: "导入完成",
        description: `新增 ${result.created} 条，更新 ${result.updated} 条${
          result.failed ? `，失败 ${result.failed} 条` : ""
        }`,
      });
      onOpenChange(false);
      onChanged();
    } catch (err) {
      toast({
        title: "导入失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>数据导入导出</DialogTitle>
          <DialogDescription>
            备份当前任务到文件，或从备份文件恢复数据。
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="export">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              导出
            </TabsTrigger>
            <TabsTrigger value="import">
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              导入
            </TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={exportJson}
                className="flex flex-col items-start gap-2 rounded-xl border p-4 text-left hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors"
              >
                <FileJson className="h-6 w-6 text-emerald-500" />
                <div>
                  <div className="font-medium">JSON 格式</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    完整数据，可用于恢复
                  </div>
                </div>
              </button>
              <button
                onClick={exportCsv}
                className="flex flex-col items-start gap-2 rounded-xl border p-4 text-left hover:border-emerald-400 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors"
              >
                <FileSpreadsheet className="h-6 w-6 text-emerald-500" />
                <div>
                  <div className="font-medium">CSV 格式</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Excel 可打开，仅查看用
                  </div>
                </div>
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              导出文件包含所有未删除任务的全部字段（含子任务、标签、笔记）。
            </p>
          </TabsContent>

          <TabsContent value="import" className="mt-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFiles(e.dataTransfer.files);
              }}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center cursor-pointer transition-colors",
                dragOver
                  ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30"
                  : "border-border hover:border-emerald-400 hover:bg-emerald-50/30",
              )}
            >
              {importing ? (
                <>
                  <div className="h-10 w-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  <div className="text-sm font-medium">导入中...</div>
                </>
              ) : (
                <>
                  <div className="rounded-full bg-emerald-100 dark:bg-emerald-950/40 p-3">
                    <Upload className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <div className="font-medium">点击或拖拽文件到此</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      支持 .json 格式，会按 ID 智能合并（已有 ID 更新，新 ID 创建）
                    </div>
                  </div>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-700 dark:text-amber-300">
              <Check className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                导入是安全的：不会删除现有任务，只会按 ID 合并。同名不同 ID 会被视为新任务。
              </span>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
