import { NextResponse } from "next/server";

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || "qatarcentral";
const AZURE_VOICE = process.env.AZURE_SPEECH_VOICE || "ar-SA-HamedNeural";

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function speechText(value) {
  return String(value || "")
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSsml(text) {
  const safe = escapeXml(speechText(text));
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><voice name="${escapeXml(AZURE_VOICE)}"><prosody rate="-8%" pitch="+0Hz" volume="+0%">${safe}</prosody></voice></speak>`;
}

async function synthesize(text) {
  if (!AZURE_SPEECH_KEY) return null;
  const response = await fetch(`https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
      "X-Microsoft-OutputFormat": "audio-24khz-160kbitrate-mono-mp3",
      "Content-Type": "application/ssml+xml",
      "User-Agent": "Najran-Continuous-Education-TTS/1.0",
    },
    body: buildSsml(text),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer()).toString("base64");
}

export async function POST(request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ error: "الرسالة مطلوبة" }, { status: 400 });

    const headers = { "Content-Type": "application/json; charset=utf-8" };
    const authorization = request.headers.get("authorization");
    if (authorization) headers.Authorization = authorization;
    const cookie = request.headers.get("cookie");
    if (cookie) headers.Cookie = cookie;

    const origin = new URL(request.url).origin;
    const chatResponse = await fetch(`${origin}/api/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const chatData = await chatResponse.json().catch(() => null);
    if (!chatResponse.ok) return NextResponse.json(chatData || { error: "تعذر الاتصال بالمساعد" }, { status: chatResponse.status });

    const reply = String(chatData?.reply || "").trim();
    if (!reply) return NextResponse.json({ ...chatData, audio: null, audioType: null });

    // استخدم الصوت القادم من n8n مباشرةً. هذا يمنع إعادة توليد الصوت مرتين.
    if (typeof chatData?.audio === "string" && chatData.audio.length > 0) {
      return NextResponse.json({
        reply,
        audio: chatData.audio,
        audioType: chatData.audioType || "audio/mpeg",
      });
    }

    // حل احتياطي مؤقت إذا لم يرسل n8n الصوت بعد.
    const audio = await synthesize(reply);
    return NextResponse.json({ reply, audio, audioType: audio ? "audio/mpeg" : null });
  } catch (error) {
    console.error("[chat-audio] Unexpected error:", error);
    return NextResponse.json({ error: "تعذر معالجة الطلب حاليًا" }, { status: 500 });
  }
}
