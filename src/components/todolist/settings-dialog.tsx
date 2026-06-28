"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAI } from "./ai-provider";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AIConfigState {
  baseUrl: string;
  apiKey: string; // empty string = use existing saved key
  model: string;
  enabled: boolean;
  hasApiKey: boolean;
  apiKeyPreview: string;
}

const MODELS = [
  { value: "glm-4-plus", label: "GLM-4-Plus（推荐，性价比高）" },
  { value: "glm-4.5", label: "GLM-4.5（更强推理）" },
  { value: "glm-4.6", label: "GLM-4.6（最新）" },
  { value: "glm-4-flash", label: "GLM-4-Flash（免费，速度快）" },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const ai = useAI();
  const [config, setConfig] = useState<AIConfigState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: boolean; message: string } | null
  >(null);
  const [showKey, setShowKey] = useState(false);

  // Load config when dialog opens
  useEffect(() => {
    if (open) {
      setTestResult(null);
      setShowKey(false);
      loadConfig();
    }
     
  }, [open]);

  async function loadConfig() {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/settings", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("加载配置失败");
      }
      const data = await res.json();
      setConfig({
        baseUrl: data.baseUrl || "https://api.z.ai/api/paas/v4",
        apiKey: "", // don't prefill — show placeholder if hasApiKey
        model: data.model || "glm-4-plus",
        enabled: data.enabled,
        hasApiKey: data.hasApiKey,
        apiKeyPreview: data.apiKeyPreview || "",
      });
    } catch (err) {
      toast({
        title: "加载配置失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setTestResult(null);
    try {
      const body: Record<string, unknown> = {
        baseUrl: config.baseUrl,
        model: config.model,
        enabled: config.enabled,
      };
      // Only send apiKey if user typed a new one (don't send empty string
      // which would clear the existing key)
      if (config.apiKey) {
        body.apiKey = config.apiKey;
      }
      const res = await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "保存失败");
      }
      const data = await res.json();
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              apiKey: "", // clear the input after save
              hasApiKey: data.config.hasApiKey,
              apiKeyPreview: data.config.apiKeyPreview,
              enabled: data.config.enabled,
            }
          : prev,
      );
      // Refresh global AI state so all components re-evaluate
      await ai.refresh();
      toast({ title: "设置已保存" });
    } catch (err) {
      toast({
        title: "保存失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!config) return;
    if (!config.apiKey && !config.hasApiKey) {
      toast({
        title: "请先填写 API Key",
        variant: "destructive",
      });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const body: Record<string, unknown> = {
        baseUrl: config.baseUrl,
        model: config.model,
      };
      if (config.apiKey) {
        body.apiKey = config.apiKey;
      }
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        setTestResult({
          ok: true,
          message: `连接成功，延迟 ${data.latencyMs}ms，模型 ${data.model}`,
        });
      } else {
        setTestResult({ ok: false, message: data.error || "测试失败" });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : "未知错误",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            AI 设置
          </DialogTitle>
          <DialogDescription>
            配置 Z.ai GLM 模型的 API 凭证以启用 AI 功能。配置保存在本地的
            <code className="mx-1 px-1 py-0.5 rounded bg-muted text-xs">.z-ai-config</code>
            文件中。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            加载配置中...
          </div>
        ) : config ? (
          <div className="space-y-4 py-2">
            {/* Enable toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="text-sm font-medium">启用 AI 功能</div>
                  <div className="text-xs text-muted-foreground">
                    关闭后所有 AI 按钮和入口将隐藏
                  </div>
                </div>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(v) =>
                  setConfig({ ...config, enabled: v })
                }
              />
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                API Key
                {config.hasApiKey && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-normal">
                    当前已设置：{config.apiKeyPreview}
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={config.apiKey}
                  onChange={(e) =>
                    setConfig({ ...config, apiKey: e.target.value })
                  }
                  placeholder={
                    config.hasApiKey
                      ? "输入新 Key 可覆盖现有配置（留空保持不变）"
                      : "请输入 Z.ai API Key"
                  }
                  className="pr-10"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  aria-label={showKey ? "隐藏" : "显示"}
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                去{" "}
                <a
                  href="https://z.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                >
                  z.ai
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>{" "}
                注册账号后创建 API Key
              </p>
            </div>

            {/* Base URL */}
            <div className="space-y-1.5">
              <Label>Base URL</Label>
              <Input
                value={config.baseUrl}
                onChange={(e) =>
                  setConfig({ ...config, baseUrl: e.target.value })
                }
                placeholder="https://api.z.ai/api/paas/v4"
              />
              <p className="text-xs text-muted-foreground">
                默认使用 Z.ai 官方地址，一般无需修改
              </p>
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <Label>模型</Label>
              <Select
                value={config.model}
                onValueChange={(v) => setConfig({ ...config, model: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                不同模型在速度、质量、价格上有差异，详见 Z.ai 文档
              </p>
            </div>

            {/* Test result */}
            {testResult && (
              <div
                className={cn(
                  "rounded-md border p-2.5 text-xs flex items-start gap-2",
                  testResult.ok
                    ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300"
                    : "border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300",
                )}
              >
                {testResult.ok ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={loading || testing || !config}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : null}
            {testing ? "测试中..." : "测试连接"}
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button onClick={handleSave} disabled={loading || saving || !config}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : null}
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
