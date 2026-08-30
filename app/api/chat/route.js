import { NextResponse } from "next/server";
import { searchKnowledgeFromSupabase } from "@/lib/knowledge-server";

const N8N_WEBHOOK_URL = process.env.N8N_EDUCATION_WEBHOOK_URL || "https://abrahem606.app.n8n.cloud/webhook/najran-education-ai";
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || "qatarcentral";
const AZURE_VOICE = process.env.AZURE_SPEECH_VOICE || "ar-SA-HamedNeural";

function polishForSpeech(value) {
  return String(value)
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "")
    .replace(/^[•\-*\d]+[.)]?\s*/gm, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
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
  const escaped = escapeXml(polishForSpeech(text));
  const voice = escapeXml(AZURE_VOICE);
  if (!enhanced) return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><voice name="${voice}">${escaped}</voice></speak>`;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><voice name="${voice}"><prosody rate="-3%" pitch="0%" volume="+1dB">${escaped}</prosody></voice></speak>`;
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

function buildKnowledgeContext(matches) {
  if (!matches.length) {
    return "لم توجد مادة مطابقة مباشرة في قاعدة المعرفة الحالية. لا تفترض تفاصيل غير موثقة، واذكر للمستفيد أن المعلومة غير متاحة في المصادر المتصلة.";
  }
  return matches.map((item) => [
    `العنوان: ${item.title}`,
    `الفئة: ${item.category || "عام"}`,
    `الخدمة: ${item.service || "غير محددة"}`,
    `المحتوى الموثق: ${item.content}`,
    `المصدر الرسمي: ${item.sourceUrl || "غير متوفر"}`,
    `تاريخ التحقق: ${item.verifiedAt || "غير متوفر"}`,
  ].join("\n")).join("\n\n");
}

function buildResponseInstructions(message) {
  const normalized = String(message).replace(/[؟?،,.:؛;]/g, " ").replace(/\s+/g, " ").trim();
  const asksForDepartments = /(ما هي|وش هي|وش|اذكر|اذكري|قائمة|اسماء|أسماء|إدارات|جهات|اقسام|أقسام)/u.test(normalized) && /(إدارة التعليم|تعليم نجران|نجران)/u.test(normalized);
  const asksForDetails = /(اختصاص|مهام|دور|تفاصيل|مسؤول|مسؤولة)/u.test(normalized);
  if (asksForDepartments && asksForDetails) {
    return "أعطِ الإجابة مباشرة من المادة المرجعية. اذكر أسماء الإدارات والجهات الواردة في المرجع، ثم اشرح اختصاص كل إدارة فقط إذا كان اختصاصها مذكورًا في المرجع. لا تكتفِ بإحالة المستخدم إلى الرابط، ولا تقل إن المعلومات غير متوفرة إذا كانت موجودة في المرجع.";
  }
  if (asksForDepartments) {
    return "أعطِ أسماء الإدارات والجهات الواردة في المرجع مباشرة وبشكل منظم. لا تكتفِ بذكر أن الموقع الرسمي يعرضها، ولا تحِل المستخدم إلى الرابط بدل الإجابة. إذا كان عدد الأسماء كبيرًا، استخدم قائمة قصيرة وواضحة.";
  }
  return "أجب عن سؤال المستفيد مباشرة اعتمادًا على المرجع. لا تكتفِ بالإشارة إلى الرابط إذا كانت المعلومة نفسها موجودة. لا تخترع شرطًا أو إجراءً أو موعدًا أو رقمًا أو جهة غير موجودة في المرجع.";
}

export async function POST(request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ error: "الرسالة مطلوبة" }, { status: 400 });

    const matches = await searchKnowledgeFromSupabase(message);
    const enrichedMessage = [
      "طلب المستفيد:",
      message,
      "",
      "مرجع قاعدة المعرفة الرسمية من Supabase:",
      buildKnowledgeContext(matches),
      "",
      "تعليمات الإجابة:",
      buildResponseInstructions(message),
      "",
      "قاعدة عامة:",
      "استخدم الحقائق الموجودة في المرجع. إذا كانت المادة المرجعية لا تتضمن التفصيل المطلوب، صرّح بذلك بوضوح بدل اختراع معلومات."
    ].join("\n");

    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ message: enrichedMessage, user_message: message }),
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
