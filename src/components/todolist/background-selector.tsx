"use client";

import * as React from "react";
import { Image as ImageIcon, X, Check, Palette } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// 5 solid colors, light → dark. Stored as CSS background value.
export const PRESET_BACKGROUNDS: {
  id: string;
  label: string;
  css: string; // value for `background`
  preview: string; // small swatch preview
  textTheme: "light" | "dark"; // whether text should be light-on-dark or dark-on-light
}[] = [
  {
    id: "none",
    label: "默认",
    css: "",
    preview:
      "linear-gradient(135deg, oklch(0.98 0.01 135), oklch(0.95 0.02 80))",
    textTheme: "dark",
  },
  {
    id: "cream",
    label: "米黄",
    css: "linear-gradient(135deg, #fef9e7 0%, #fdebd0 100%)",
    preview: "linear-gradient(135deg, #fef9e7, #fdebd0)",
    textTheme: "dark",
  },
  {
    id: "sage",
    label: "草绿",
    css: "linear-gradient(135deg, #d4e9d7 0%, #a8d5ba 100%)",
    preview: "linear-gradient(135deg, #d4e9d7, #a8d5ba)",
    textTheme: "dark",
  },
  {
    id: "sky",
    label: "天蓝",
    css: "linear-gradient(135deg, #cce7f6 0%, #8ec5e8 100%)",
    preview: "linear-gradient(135deg, #cce7f6, #8ec5e8)",
    textTheme: "dark",
  },
  {
    id: "twilight",
    label: "暮色",
    css: "linear-gradient(135deg, #4a4e69 0%, #22223b 100%)",
    preview: "linear-gradient(135deg, #4a4e69, #22223b)",
    textTheme: "light",
  },
  {
    id: "ink",
    label: "墨黑",
    css: "linear-gradient(135deg, #1a1a2e 0%, #0f0f1e 100%)",
    preview: "linear-gradient(135deg, #1a1a2e, #0f0f1e)",
    textTheme: "light",
  },
];

const STORAGE_KEY = "todolist.background";
const MAX_BYTES = 5 * 1024 * 1024;

export interface BackgroundState {
  type: "preset" | "image" | "none";
  presetId?: string;
  imageUrl?: string;
  textTheme: "light" | "dark";
}

function loadState(): BackgroundState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BackgroundState;
  } catch {
    return null;
  }
}

function saveState(state: BackgroundState | null) {
  if (typeof window === "undefined") return;
  if (state === null) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

export function applyBackground(state: BackgroundState | null): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  const root = document.documentElement;
  const body = document.body;
  if (!state || state.type === "none") {
    body.style.backgroundImage = "";
    body.style.backgroundSize = "";
    body.style.backgroundPosition = "";
    body.style.backgroundAttachment = "";
    return "dark";
  }
  if (state.type === "preset") {
    const preset = PRESET_BACKGROUNDS.find((p) => p.id === state.presetId);
    if (!preset) return "dark";
    body.style.backgroundImage = preset.css;
    body.style.backgroundSize = "cover";
    body.style.backgroundPosition = "center";
    body.style.backgroundAttachment = "fixed";
    return preset.textTheme;
  }
  if (state.type === "image" && state.imageUrl) {
    body.style.backgroundImage = `url("${state.imageUrl}")`;
    body.style.backgroundSize = "cover";
    body.style.backgroundPosition = "center";
    body.style.backgroundAttachment = "fixed";
    return state.textTheme;
  }
  return "dark";
}

export function BackgroundSelector({
  compact = false,
}: {
  compact?: boolean;
} = {}) {
  const [state, setState] = React.useState<BackgroundState | null>(null);
  const [open, setOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);

  React.useEffect(() => {
    const loaded = loadState();
    setState(loaded);
    applyBackground(loaded);
  }, []);

  function update(next: BackgroundState | null) {
    setState(next);
    saveState(next);
    applyBackground(next);
  }

  function selectPreset(presetId: string) {
    if (presetId === "none") {
      update(null);
    } else {
      const preset = PRESET_BACKGROUNDS.find((p) => p.id === presetId);
      if (!preset) return;
      update({
        type: "preset",
        presetId,
        textTheme: preset.textTheme,
      });
    }
    setOpen(false);
  }

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast({
        title: "图片过大",
        description: `图片大小不能超过 5MB（当前 ${(file.size / 1024 / 1024).toFixed(2)}MB）`,
        variant: "destructive",
      });
      return;
    }
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
    if (!allowed.includes((file.type || "").toLowerCase())) {
      toast({
        title: "格式不支持",
        description: "仅支持 PNG / JPEG / WebP / GIF",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/settings/background", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "上传失败");
      }
      const data = await res.json();
      update({
        type: "image",
        imageUrl: data.url,
        textTheme: "light", // images are usually busy → light text is safer
      });
      toast({ title: "背景已更新", description: "已设置自定义背景图" });
      setOpen(false);
    } catch (err) {
      toast({
        title: "上传失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const currentPreset = state?.type === "preset" ? state.presetId : state?.type === "none" || !state ? "none" : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={compact ? "h-7 w-7" : "h-9 w-9"}
          aria-label="选择背景"
          title="选择背景颜色或图片"
        >
          <Palette className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium mb-1">背景设置</h4>
            <p className="text-xs text-muted-foreground">
              选择纯色主题或上传自定义图片（≤5MB）
            </p>
          </div>

          {/* Preset swatches */}
          <div className="grid grid-cols-3 gap-2">
            {PRESET_BACKGROUNDS.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPreset(p.id)}
                className={cn(
                  "relative aspect-square rounded-lg border-2 transition-all",
                  "hover:scale-105 hover:shadow-md",
                  currentPreset === p.id
                    ? "border-emerald-500 ring-2 ring-emerald-200"
                    : "border-border",
                )}
                style={{ background: p.preview }}
                title={p.label}
              >
                <span
                  className={cn(
                    "absolute bottom-1 left-0 right-0 text-[10px] font-medium text-center",
                    p.textTheme === "light" ? "text-white" : "text-slate-700",
                  )}
                >
                  {p.label}
                </span>
                {currentPreset === p.id && (
                  <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="h-2.5 w-2.5 text-white" />
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="border-t pt-3">
            {/* Upload */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files.length > 0) {
                  handleFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => !uploading && fileRef.current?.click()}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-center cursor-pointer transition-colors",
                dragOver
                  ? "border-emerald-500 bg-emerald-50/50"
                  : "border-border hover:border-emerald-400 hover:bg-muted/40",
              )}
            >
              {uploading ? (
                <>
                  <div className="h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                  <span className="text-xs text-muted-foreground">上传中...</span>
                </>
              ) : state?.type === "image" ? (
                <>
                  <div
                    className="h-10 w-full rounded-md bg-cover bg-center"
                    style={{ backgroundImage: `url("${state.imageUrl}")` }}
                  />
                  <span className="text-xs text-muted-foreground">
                    点击或拖拽以替换图片
                  </span>
                </>
              ) : (
                <>
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  <div className="text-xs">
                    <div className="font-medium">上传自定义图片</div>
                    <div className="text-muted-foreground mt-0.5">
                      PNG / JPEG / WebP / GIF · ≤5MB
                    </div>
                  </div>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFile(e.target.files[0]);
                  }
                }}
              />
            </div>
          </div>

          {state && state.type !== "none" && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-rose-600 hover:text-rose-700"
              onClick={() => {
                update(null);
                setOpen(false);
                toast({ title: "已恢复默认背景" });
              }}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              清除自定义背景
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
