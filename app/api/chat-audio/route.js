import { NextResponse } from "next/server";

const N8N_WEBHOOK_URL = process.env.N8N_EDUCATION_WEBHOOK_URL || "https://abrahem606.app.n8n.cloud/webhook/najran-education-ai";

function audioToBase64(buffer) {
  return Buffer.from(buffer).toString("base64");
}

export async function POST(request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json({ error: "الرسالة مطلوبة" }, { status: 400 });
    }

    // n8n is the single processing path for the assistant: AI Agent + knowledge + Azure TTS.
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "audio/mpeg, application/json",
      },
      body: JSON.stringify({ message }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[chat-audio] n8n failed", response.status, errorText.slice(0, 1000));
      return NextResponse.json({ error: "تعذر الاتصال بالمساعد التعليمي" }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "";

    // Current n8n production workflow returns the generated MP3 as a binary file.
    if (contentType.includes("audio/")) {
      const buffer = await response.arrayBuffer();
      const audio = audioToBase64(buffer);
      return NextResponse.json({
        reply: "تم استلام الرد الصوتي من المساعد التعليمي.",
        audio,
        audioType: contentType.split(";")[0] || "audio/mpeg",
      });
    }

    // Keep compatibility if n8n is later configured to return JSON { reply, audio, audioType }.
    const data = await response.json().catch(() => null);
    if (!data) {
      return NextResponse.json({ error: "تعذر قراءة رد المساعد التعليمي" }, { status: 502 });
    }

    return NextResponse.json({
      reply: String(data.reply ?? data.output ?? "").trim(),
      audio: data.audio ?? null,
      audioType: data.audioType ?? null,
    });
  } catch (error) {
    console.error("[chat-audio] Unexpected error:", error);
    return NextResponse.json({ error: "تعذر معالجة الطلب حاليًا" }, { status: 500 });
  }
}
