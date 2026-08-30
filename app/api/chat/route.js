import { NextResponse } from "next/server";

const N8N_WEBHOOK_URL = process.env.N8N_EDUCATION_WEBHOOK_URL || "https://abrahem606.app.n8n.cloud/webhook/najran-education-ai";
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || "qatarcentral";
const AZURE_VOICE = process.env.AZURE_SPEECH_VOICE || "ar-SA-HamedNeural";

function cleanForSpeech(value) {
  return String(value)
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildSsml(text) {
  const escaped = escapeXml(cleanForSpeech(text));
  return escaped
    .replace(/\n+/g, '<break time="420ms"/>')
    .replace(/،/g, '،<break time="170ms"/>')
    .replace(/؛/g, '؛<break time="230ms"/>')
    .replace(/[.!؟]/g, (m) => `${m}<break time="360ms"/>`)
    .replace(/:/g, ':<break time="220ms"/>');
}

export async function POST(request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ error: "الرسالة مطلوبة" }, { status: 400 });

    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ message }),
      cache: "no-store",
    });

    if (!n8nResponse.ok) {
      return NextResponse.json({ error: "تعذر الاتصال بالمساعد التعليمي" }, { status: 502 });
    }

    const n8nData = await n8nResponse.json();
    const reply = String(n8nData?.reply ?? n8nData?.output ?? "").trim();
    if (!reply) return NextResponse.json({ error: "لم يصل رد من المساعد" }, { status: 502 });

    if (!AZURE_SPEECH_KEY) {
      return NextResponse.json({ reply, audio: null, audioType: null });
    }

    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><voice name="${escapeXml(AZURE_VOICE)}"><prosody rate="-8%" pitch="+1%" volume="+1dB">${buildSsml(reply)}</prosody></voice></speak>`;

    const ttsResponse = await fetch(`https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
        "X-Microsoft-OutputFormat": "audio-24khz-160kbitrate-mono-mp3",
        "Content-Type": "application/ssml+xml",
      },
      body: ssml,
      cache: "no-store",
    });

    if (!ttsResponse.ok) return NextResponse.json({ reply, audio: null, audioType: null });

    const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
    return NextResponse.json({
      reply,
      audio: audioBuffer.toString("base64"),
      audioType: "audio/mpeg",
    });
  } catch (error) {
    return NextResponse.json({ error: "تعذر معالجة الطلب حاليًا" }, { status: 500 });
  }
}
