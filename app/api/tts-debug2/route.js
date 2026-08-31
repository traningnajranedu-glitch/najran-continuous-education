import { NextResponse } from "next/server";

const REGION = process.env.AZURE_SPEECH_REGION || "qatarcentral";
const VOICE = process.env.AZURE_SPEECH_VOICE || "ar-SA-HamedNeural";
const KEY = process.env.AZURE_SPEECH_KEY;

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export async function GET() {
  if (!KEY) {
    return NextResponse.json({ ok: false, error: "AZURE_SPEECH_KEY is missing" }, { status: 500 });
  }

  const text = "السلام عليكم. هذا اختبار للصوت العربي في المساعد التعليمي.";
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><voice name="${escapeXml(VOICE)}">${escapeXml(text)}</voice></speak>`;
  const url = `https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": KEY,
        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
        "Content-Type": "application/ssml+xml",
        "User-Agent": "Najran-Continuous-Education-TTS/1.0",
      },
      body: ssml,
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[TTS] Azure failed", { status: response.status, region: REGION, voice: VOICE, errorText: errorText.slice(0, 2000) });
      return NextResponse.json({ ok: false, status: response.status, statusText: response.statusText, region: REGION, voice: VOICE, azureError: errorText.slice(0, 2000) }, { status: 502 });
    }

    const bytes = new Uint8Array(await response.arrayBuffer()).length;
    return NextResponse.json({ ok: true, status: response.status, region: REGION, voice: VOICE, contentType: response.headers.get("content-type"), bytes });
  } catch (error) {
    console.error("[TTS] Azure exception", error);
    return NextResponse.json({ ok: false, error: "Azure TTS request failed", region: REGION, voice: VOICE }, { status: 502 });
  }
}
