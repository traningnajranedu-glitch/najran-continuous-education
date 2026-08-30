import { NextResponse } from "next/server";
import { NAJRAN_KNOWLEDGE, searchNajranKnowledge } from "@/data/najran-knowledge";

const N8N_WEBHOOK_URL = process.env.N8N_EDUCATION_WEBHOOK_URL || "https://abrahem606.app.n8n.cloud/webhook/najran-education-ai";
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || "qatarcentral";
const AZURE_VOICE = process.env.AZURE_SPEECH_VOICE || "ar-SA-HamedNeural";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || "traningnajranedu-glitch/najran-continuous-education";
const KNOWLEDGE_PATH = "data/najran-knowledge.json";

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
    .replaceAll('\"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildSsml(text, enhanced = true) {
  const cleaned = polishForSpeech(text);
  const escaped = escapeXml(cleaned);
  if (!enhanced) return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><voice name="${escapeXml(AZURE_VOICE)}">${escaped}</voice></speak>`;
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

function searchKnowledge(items, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  return items.map(item => {
    const haystack = [item.title, item.category, ...(item.keywords || []), item.content].join(" ").toLowerCase();
    const score = terms.reduce((n, term) => n + (haystack.includes(term) ? 1 : 0), 0);
    return { item, score };
  }).filter(x => x.score > 0).sort((a,b) => b.score-a.score).slice(0,3).map(x => x.item);
}

async function loadKnowledge() {
  if (!GITHUB_TOKEN) return NAJRAN_KNOWLEDGE;
  try {
    const [owner, repo] = GITHUB_REPOSITORY.split("/");
    const r = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${KNOWLEDGE_PATH}?ref=main`, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      cache: "no-store",
    });
    if (!r.ok) return NAJRAN_KNOWLEDGE;
    const d = await r.json();
    const items = JSON.parse(Buffer.from(d.content, "base64").toString("utf8"));
    return Array.isArray(items) ? items.filter(x => x.active !== false) : NAJRAN_KNOWLEDGE;
  } catch {
    return NAJRAN_KNOWLEDGE;
  }
}

async function buildEnrichedMessage(message) {
  const knowledgeItems = await loadKnowledge();
  const matches = searchKnowledge(knowledgeItems, message);
  if (!matches.length) return [
    "طلب المستفيد:", message, "",
    "مرجع قاعدة المعرفة:",
    "لم توجد مادة مطابقة مباشرة. لا تفترض تفاصيل غير موثقة، واذكر للمستفيد أن المعلومة غير متاحة في المصادر المتصلة."
  ].join("\n");
  const context = matches.map(item => [
    `العنوان: ${item.title}`,
    `الفئة: ${item.category}`,
    `المحتوى الموثق: ${item.content}`,
    `المصدر الرسمي: ${item.sourceUrl}`,
    `تاريخ التحقق: ${item.verifiedAt}`,
  ].join("\n")).join("\n\n");
  return [
    "طلب المستفيد:", message, "",
    "مرجع قاعدة المعرفة الرسمية:", context, "",
    "تعليمات:",
    "استخدم المرجع لتثبيت الحقائق. لا تخترع إجراءً أو شرطًا أو موعدًا أو رقمًا غير موجود في المرجع. إذا لم تكفِ المعلومات، صرّح بعدم توفرها ووجّه إلى المصدر الرسمي عند وجوده."
  ].join("\n");
}

export async function POST(request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ error: "الرسالة مطلوبة" }, { status: 400 });

    const enrichedMessage = await buildEnrichedMessage(message);
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
