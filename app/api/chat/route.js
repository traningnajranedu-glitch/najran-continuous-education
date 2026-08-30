import { NextResponse } from "next/server";
import { searchKnowledgeFromSupabase } from "@/lib/knowledge-server";

const SUPABASE_URL = "https://cbqtmssmnetbnuohnacz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6nHVWHU7JzUVkxBzavXdYQ_s-uR4kE7";
const N8N_WEBHOOK_URL = process.env.N8N_EDUCATION_WEBHOOK_URL || "https://abrahem606.app.n8n.cloud/webhook/najran-education-ai";
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || "qatarcentral";
const AZURE_VOICE = process.env.AZURE_SPEECH_VOICE || "ar-SA-HamedNeural";

function polishForSpeech(value) {
  return String(value).replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "").replace(/^[•\-*\d]+[.)]?\s*/gm, "").replace(/^#{1,6}\s*/gm, "").replace(/\*\*/g, "").replace(/\*/g, "").replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1").replace(/\s+/g, " ").trim();
}
function escapeXml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;"); }
function buildSsml(text, enhanced = true) {
  const escaped = escapeXml(polishForSpeech(text));
  const voice = escapeXml(AZURE_VOICE);
  if (!enhanced) return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><voice name="${voice}">${escaped}</voice></speak>`;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><voice name="${voice}"><prosody rate="-3%" pitch="0%" volume="+1dB">${escaped}</prosody></voice></speak>`;
}
async function synthesize(ssml) { return fetch(`https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, { method: "POST", headers: { "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY, "X-Microsoft-OutputFormat": "audio-24khz-160kbitrate-mono-mp3", "Content-Type": "application/ssml+xml" }, body: ssml, cache: "no-store" }); }
function buildKnowledgeContext(matches) {
  if (!matches.length) return "لم توجد مادة مطابقة مباشرة في قاعدة المعرفة الحالية. لا تفترض تفاصيل غير موثقة، واذكر للمستفيد أن المعلومة غير متاحة في المصادر المتصلة.";
  return matches.map((item) => [`العنوان: ${item.title}`, `الفئة: ${item.category || "عام"}`, `الخدمة: ${item.service || "غير محددة"}`, `المحتوى الموثق: ${item.content}`, `المصدر الرسمي: ${item.sourceUrl || "غير متوفر"}`, `تاريخ التحقق: ${item.verifiedAt || "غير متوفر"}`].join("\n")).join("\n\n");
}
function buildResponseInstructions(message) {
  const normalized = String(message).replace(/[؟?،,.:؛;]/g, " ").replace(/\s+/g, " ").trim();
  const asksForDepartments = /(ما هي|وش هي|وش|اذكر|اذكري|قائمة|اسماء|أسماء|إدارات|جهات|اقسام|أقسام)/u.test(normalized) && /(إدارة التعليم|تعليم نجران|نجران)/u.test(normalized);
  const asksForDetails = /(اختصاص|مهام|دور|تفاصيل|مسؤول|مسؤولة)/u.test(normalized);
  if (asksForDepartments && asksForDetails) return "أعطِ الإجابة مباشرة من المادة المرجعية. اذكر أسماء الإدارات والجهات الواردة في المرجع، ثم اشرح اختصاص كل إدارة فقط إذا كان اختصاصها مذكورًا في المرجع. لا تكتفِ بإحالة المستخدم إلى الرابط.";
  if (asksForDepartments) return "أعطِ أسماء الإدارات والجهات الواردة في المرجع مباشرة وبشكل منظم. لا تكتفِ بذكر الرابط بدل الإجابة.";
  return "أجب عن سؤال المستفيد مباشرة اعتمادًا على المرجع. لا تخترع شرطًا أو إجراءً أو موعدًا أو رقمًا أو جهة غير موجودة في المرجع.";
}
function readCookie(request, name) {
  const cookies = request.headers.get("cookie") || "";
  const match = cookies.split(";").map((v) => v.trim()).find((v) => v.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}
async function lookupRequestStatus(message, request) {
  const isStatusQuestion = /(حالة|وضع|وين وصل|وصل|متابعة|مستجدات).*(طلب|معاملة|تذكرة)|رقم.*(طلب|معاملة)/u.test(message) && /\d{3,}/.test(message);
  if (!isStatusQuestion) return null;
  const authHeader = request.headers.get("authorization") || "";
  const headerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const accessToken = headerToken || readCookie(request, "school_access_token");
  if (!accessToken) return { protected: true, text: "لا يمكن عرض حالة الطلب من المساعد العام دون تسجيل دخول مصرح به إلى بوابة المدرسة." };
  const requestNumber = message.match(/\d{3,}/)?.[0];
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/lookup_request_status`, { method: "POST", headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ p_request_number: requestNumber }), cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { protected: true, text: "تعذر التحقق من صلاحية الاستعلام عن حالة الطلب." };
  const item = Array.isArray(data) ? data[0] : data;
  if (!item) return { protected: true, text: `لم أجد طلبًا بالرقم ${requestNumber} ضمن التقارير المرتبطة بمدرستك.` };
  return { protected: true, text: [`حالة الطلب رقم ${item.request_number}: ${item.status || "غير محددة"}.`, item.service ? `الخدمة: ${item.service}.` : "", item.status_date ? `تاريخ الحالة: ${item.status_date}.` : "", item.notes ? `ملاحظات: ${item.notes}.` : ""].filter(Boolean).join(" ") };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ error: "الرسالة مطلوبة" }, { status: 400 });
    const requestStatus = await lookupRequestStatus(message, request);
    if (requestStatus?.protected && requestStatus.text.includes("حالة الطلب رقم")) {
      const reply = requestStatus.text;
      if (!AZURE_SPEECH_KEY) return NextResponse.json({ reply, audio: null, audioType: null });
      let ttsResponse = await synthesize(buildSsml(reply, true));
      if (!ttsResponse.ok) ttsResponse = await synthesize(buildSsml(reply, false));
      if (!ttsResponse.ok) return NextResponse.json({ reply, audio: null, audioType: null });
      return NextResponse.json({ reply, audio: Buffer.from(await ttsResponse.arrayBuffer()).toString("base64"), audioType: "audio/mpeg" });
    }
    const matches = await searchKnowledgeFromSupabase(message);
    let enrichedMessage = ["طلب المستفيد:", message, "", "مرجع قاعدة المعرفة الرسمية من Supabase:", buildKnowledgeContext(matches), "", "تعليمات الإجابة:", buildResponseInstructions(message), "", "قاعدة عامة:", "استخدم الحقائق الموجودة في المرجع. إذا كانت المادة المرجعية لا تتضمن التفصيل المطلوب، صرّح بذلك بوضوح بدل اختراع معلومات."].join("\n");
    if (requestStatus?.text) enrichedMessage += `\n\nتنبيه أمني: ${requestStatus.text}`;
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ message: enrichedMessage, user_message: message }), cache: "no-store" });
    if (!n8nResponse.ok) return NextResponse.json({ error: "تعذر الاتصال بالمساعد التعليمي" }, { status: 502 });
    const n8nData = await n8nResponse.json();
    const reply = String(n8nData?.reply ?? n8nData?.output ?? "").trim();
    if (!reply) return NextResponse.json({ error: "لم يصل رد من المساعد" }, { status: 502 });
    if (!AZURE_SPEECH_KEY) return NextResponse.json({ reply, audio: null, audioType: null });
    let ttsResponse = await synthesize(buildSsml(reply, true));
    if (!ttsResponse.ok) ttsResponse = await synthesize(buildSsml(reply, false));
    if (!ttsResponse.ok) return NextResponse.json({ reply, audio: null, audioType: null });
    return NextResponse.json({ reply, audio: Buffer.from(await ttsResponse.arrayBuffer()).toString("base64"), audioType: "audio/mpeg" });
  } catch {
    return NextResponse.json({ error: "تعذر معالجة الطلب حاليًا" }, { status: 500 });
  }
}
