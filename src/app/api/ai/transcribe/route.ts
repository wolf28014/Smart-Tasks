import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { aiErrorResponse } from "@/lib/ai-client";

// POST /api/ai/transcribe
// Body: { audio: string }  (base64-encoded audio, with or without data: prefix)
// Returns: { text: string }
//
// Uses ZAI's ASR (speech-to-text) to transcribe the recorded audio.
// The frontend records via the browser's MediaRecorder API and sends
// the resulting base64 string here.

export async function POST(req: NextRequest) {
  let body: { audio?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 });
  }

  const audio = body.audio ?? "";
  if (!audio) {
    return NextResponse.json({ error: "音频数据不能为空" }, { status: 400 });
  }

  // Strip data:audio/...;base64, prefix if present
  const base64 = audio.replace(/^data:audio\/[a-z]+;base64,/, "");

  try {
    const zai = await ZAI.create();
    const result = (await zai.audio.asr.create({
      file_base64: base64,
    })) as { text?: string } | string;

    // ASR may return either an object with text or a plain string
    const text =
      typeof result === "string"
        ? result
        : typeof result?.text === "string"
          ? result.text
          : "";

    if (!text.trim()) {
      return NextResponse.json(
        { error: "未能识别出语音内容，请重试" },
        { status: 422 },
      );
    }

    return NextResponse.json({ text: text.trim() });
  } catch (err) {
    const { status, body: errBody } = aiErrorResponse(err);
    return NextResponse.json(errBody, { status });
  }
}
