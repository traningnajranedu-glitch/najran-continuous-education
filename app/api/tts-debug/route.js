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
    console.error("[TTS] AZURE_SPEECH_KEY is missing");
    return NextResponse.json({ ok: false, error: "AZURE_SPEECH_KEY is missing" }, { status: 500 });
  }

  const text = "السلام عليكم. هذا اختبار للصوت العربي في المساعد التعليمي.";
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><voice name="${escapeXml(VOICE)}"><prosody rate="0%" pitch="+1%" volume="+1dB">${escapeXml(text)}</prosody></voice></speak>`;
  const url = `https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": KEY,
        "X-Microsoft-OutputFormat": "audio-24khz-160kbitrate-mono-mp3",
        "Content-Type": "application/ssml+xml",
      },
      body: ssml,
      cache: "no-store",
    });

    const body = await response.text().catch(() => "");
    if (!response.ok) {
      console.error("[TTS] Azure request failed", {
        status: response.status,
        statusText: response.statusText,
        region: REGION,
        voice: VOICE,
        body: body.slice(0, 1000),
      });
      return NextResponse.json({
        ok: false,
        status: response.status,
        statusText: response.statusText,
        region: REGION,
        voice: VOICE,
        azureError: body.slice(0, 1000),
      }, { status: 502 });
    }

    console.log("[TTS] Azure test succeeded", { status: response.status, region: REGION, voice: VOICE });
    return NextResponse.json({ ok: true, status: response.status, region: REGION, voice: VOICE, contentType: response.headers.get("content-type"), bytes: body.length });
  } catch (error) {
    console.error("[TTS] Azure request exception", error);
    return NextResponse.json({ ok: false, error: "Azure TTS request failed", region: REGION, voice: VOICE }, { status: 502 });
  }
}
