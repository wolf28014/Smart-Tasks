"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface AiVoiceButtonProps {
  /** Called when transcription completes successfully. */
  onTranscript: (text: string) => void;
}

type State = "idle" | "recording" | "uploading" | "transcribing";

export function AiVoiceButton({ onTranscript }: AiVoiceButtonProps) {
  const [state, setState] = useState<State>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      stopTracks();
      if (mediaRecorderRef.current && state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
     
  }, []);

  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stopTracks();
        const blob = new Blob(chunksRef.current, {
          type: mr.mimeType || "audio/webm",
        });
        await transcribeBlob(blob);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setState("recording");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/Permission|NotAllowed/i.test(message)) {
        toast({
          title: "麦克风权限被拒绝",
          description: "请在浏览器设置里允许此页面使用麦克风",
          variant: "destructive",
        });
      } else {
        toast({
          title: "无法启动录音",
          description: message,
          variant: "destructive",
        });
      }
      setState("idle");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.stop();
      setState("uploading");
    }
  }

  async function transcribeBlob(blob: Blob) {
    setState("transcribing");
    try {
      // Convert to base64
      const base64 = await blobToBase64(blob);
      const res = await fetch("/api/ai/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio: base64 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "语音识别失败");
      }
      const data = await res.json();
      onTranscript(data.text);
    } catch (err) {
      toast({
        title: "语音识别失败",
        description: err instanceof Error ? err.message : "未知错误",
        variant: "destructive",
      });
    } finally {
      setState("idle");
    }
  }

  const handleClick = () => {
    if (state === "idle") {
      startRecording();
    } else if (state === "recording") {
      stopRecording();
    }
    // uploading/transcribing — ignore clicks
  };

  const isBusy = state === "uploading" || state === "transcribing";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        "h-9 w-9 shrink-0",
        state === "recording" &&
          "bg-rose-50 border-rose-300 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300",
      )}
      onClick={handleClick}
      disabled={isBusy}
      aria-label={
        state === "recording" ? "停止录音" : isBusy ? "识别中" : "语音输入"
      }
      title={
        state === "recording"
          ? "点击停止录音"
          : isBusy
            ? "语音识别中..."
            : "语音输入"
      }
    >
      {state === "recording" ? (
        <Square className="h-4 w-4 fill-current" />
      ) : isBusy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
      {state === "recording" && (
        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
      )}
    </Button>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("无法读取音频数据"));
      }
    };
    reader.onerror = () => reject(new Error("读取音频失败"));
    reader.readAsDataURL(blob);
  });
}
