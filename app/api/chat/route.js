import { NextResponse } from "next/server";

const N8N_WEBHOOK_URL = process.env.N8N_EDUCATION_WEBHOOK_URL || "https://abrahem606.app.n8n.cloud/webhook/najran-education-ai";
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || "qatarcentral";
const AZURE_VOICE = process.env.AZURE_SPEECH_VOICE || "ar-SA-HamedNeural";

const OFFICIAL_CONTEXT = {
  base: `مصادر رسمية مرتبطة بإدارة التعليم بمنطقة نجران:\n- https://sites.moe.gov.sa/Najran/\n- https://sites.moe.gov.sa/Najran/departments/\n- https://sites.moe.gov.sa/Najran/workplace/\n- https://sites.moe.gov.sa/Najran/contact-us/\nسياسة الدقة: استخدم هذه المصادر عندما تكون مرتبطة بالسؤال. لا تخترع شروطًا أو مواعيد أو إجراءات أو أرقامًا. إذا لم تتوفر المعلومة، صرّح بأنها غير متاحة في المصادر المتصلة.`,
  students: `الخدمات المرتبطة بالطلاب والطالبات: الموقع الرسمي لتعليم نجران يربط بنظام نور ومنصة مدرستي ومنصة روضتي وبوابة عين. المصدر: https://sites.moe.gov.sa/Najran/`,
  teachers: `الخدمات المرتبطة بالمعلمين والمعلمات: الموقع الرسمي لتعليم نجران يربط بنظام فارس. المصدر: https://sites.moe.gov.sa/Najran/`,
  schools: `الخدمات المرتبطة بالمدارس: الموقع الرسمي لتعليم نجران يوفر صفحة مكاتب التعليم، وصفحة الإدارات، ويربط بمنصة مدرستي. المصادر: https://sites.moe.gov.sa/Najran/workplace/ و https://sites.moe.gov.sa/Najran/departments/ و https://sites.moe.gov.sa/Najran/`,
  guidance: `للتوجيه والتواصل: الصفحة الرسمية لاتصل بنا لتعليم نجران تعرض عنوان الإدارة ورقم الهاتف والبريد الرسمي. المصدر: https://sites.moe.gov.sa/Najran/contact-us/`
};

function getOfficialContext(message) {
  const text = String(message).toLowerCase();
  let extra = OFFICIAL_CONTEXT.base;
  if (/طلاب|طالبات|نور|مدرستي|روضتي|عين/.test(text)) extra += "\n" + OFFICIAL_CONTEXT.students;
  if (/معلم|معلمة|معلمين|معلمات|فارس|وظيف|إجاز/.test(text)) extra += "\n" + OFFICIAL_CONTEXT.teachers;
  if (/مدرس|مدارس|مكتب التعليم|مدرست/.test(text)) extra += "\n" + OFFICIAL_CONTEXT.schools;
  if (/تواصل|هاتف|رقم|بريد|جهة مختصة|استفسار عام/.test(text)) extra += "\n" + OFFICIAL_CONTEXT.guidance;
  return extra;
}

function polishForSpeech(value) {
  return String(value)
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "")
    .replace(/^[•\-*\d]+[.)]?\s*/gm, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/\bوش\b/gu, "ما")
    .replace(/\bتبي\b/gu, "تحتاج")
    .replace(/\bأبي\b/gu, "أرغب")
    .replace(/\bمو\b/gu, "غير")
    .replace(/\bهذي\b/gu, "هذه")
    .replace(/\bاللي\b/gu, "التي")
    .replace(/\s+/g, " ")
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

function buildSsml(text, enhanced = true) {
  const cleaned = polishForSpeech(text);
  const escaped = escapeXml(cleaned);
  if (!enhanced) {
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><voice name="${escapeXml(AZURE_VOICE)}">${escaped}</voice></speak>`;
  }
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><voice name="${escapeXml(AZURE_VOICE)}"><prosody rate="-3%" pitch="0%" volume="+1dB">${escaped}</prosody></voice></speak>`;
}

async function synthesize(ssml) {
  return fetch(`https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
      "X-Microsoft-OutputFormat": "audio-24khz-160kbitrate-mono-mp3",
      "Content-Type": "application/ssml+xml",
    },
    body: ssml,
    cache: "no-store",
  });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ error: "الرسالة مطلوبة" }, { status: 400 });

    const enrichedMessage = `${message}\n\n[معلومات مرجعية رسمية للمساعد]\n${getOfficialContext(message)}`;

    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ message: enrichedMessage }),
      cache: "no-store",
    });
    if (!n8nResponse.ok) return NextResponse.json({ error: "تعذر الاتصال بالمساعد التعليمي" }, { status: 502 });

    const n8nData = await n8nResponse.json();
    const reply = String(n8nData?.reply ?? n8nData?.output ?? "").trim();
    if (!reply) return NextResponse.json({ error: "لم يصل رد من المساعد" }, { status: 502 });
    if (!AZURE_SPEECH_KEY) return NextResponse.json({ reply, audio: null, audioType: null });

    let ttsResponse = await synthesize(buildSsml(reply, true));
    if (!ttsResponse.ok) ttsResponse = await synthesize(buildSsml(reply, false));
    if (!ttsResponse.ok) return NextResponse.json({ reply, audio: null, audioType: null });

    const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());
    return NextResponse.json({ reply, audio: audioBuffer.toString("base64"), audioType: "audio/mpeg" });
  } catch {
    return NextResponse.json({ error: "تعذر معالجة الطلب حاليًا" }, { status: 500 });
  }
}
