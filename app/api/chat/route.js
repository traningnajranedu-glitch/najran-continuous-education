import { NextResponse } from "next/server";
import { searchKnowledgeFromSupabase } from "@/lib/knowledge-server";

const SUPABASE_URL = "https://cbqtmssmnetbnuohnacz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6nHVWHU7JzUVkxBzavXdYQ_s-uR4kE7";
const N8N_WEBHOOK_URL = process.env.N8N_EDUCATION_WEBHOOK_URL || "https://abrahem606.app.n8n.cloud/webhook/najran-education-ai";
const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || "qatarcentral";
const AZURE_VOICE = process.env.AZURE_SPEECH_VOICE || "ar-SA-HamedNeural";

function polishForSpeech(value) {
  return String(value)
    .replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu, "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/#{1,6}\s*/g, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
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

function speechParts(text) {
  const cleaned = polishForSpeech(text);
  return cleaned
    .split(/(?<=[.!؟؛:،])\s+|\n+/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 18);
}

function buildSsml(text, enhanced = true) {
  const parts = speechParts(text);
  const voice = escapeXml(AZURE_VOICE);
  const inner = parts.map((part, index) => {
    const safe = escapeXml(part);
    const pause = index === parts.length - 1 ? "" : '<break time="170ms"/>';
    return `<s>${safe}</s>${pause}`;
  }).join("");

  if (!enhanced) {
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ar-SA"><voice name="${voice}"><prosody rate="0%" pitch="0%" volume="+1dB">${inner}</prosody></voice></speak>`;
  }

  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="ar-SA"><voice name="${voice}"><prosody rate="0%" pitch="+1%" volume="+1dB">${inner}</prosody></voice></speak>`;
}

async function synthesize(ssml) {
  if (!AZURE_SPEECH_KEY) return null;
  let response = await fetch(`https://${AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
      "X-Microsoft-OutputFormat": "audio-24khz-160kbitrate-mono-mp3",
      "Content-Type": "application/ssml+xml",
      "User-Agent": "Najran-Continuous-Education-TTS/1.0",
    },
    body: ssml,
    cache: "no-store",
  });
  if (!response.ok) return null;
  return Buffer.from(await response.arrayBuffer()).toString("base64");
}

function buildKnowledgeContext(matches) {
  if (!matches.length) return "لم توجد مادة مطابقة مباشرة في قاعدة المعرفة الحالية. لا تفترض تفاصيل غير موثقة، واذكر للمستفيد أن المعلومة غير متاحة في المصادر المتصلة.";
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
  if (asksForDepartments && asksForDetails) return "أعطِ الإجابة مباشرة من المادة المرجعية. اذكر أسماء الإدارات والجهات الواردة في المرجع، ثم اشرح اختصاص كل إدارة فقط إذا كان اختصاصها مذكورًا في المرجع. لا تكتفِ بإحالة المستخدم إلى الرابط.";
  if (asksForDepartments) return "أعطِ أسماء الإدارات والجهات الواردة في المرجع مباشرة وبشكل منظم. لا تكتفِ بذكر الرابط بدل الإجابة.";
  return "أجب عن سؤال المستفيد مباشرة اعتمادًا على المرجع والتقرير المدرسي المنشور إن توفر. التقارير المنشورة والمعتمدة جزء من قاعدة المعرفة العامة ويمكن استخدامها لجميع مستخدمي المساعد دون طلب تسجيل دخول. إذا وجدت رقمًا أو اسمًا أو معلومة في التقرير، اذكرها مباشرة. لا تخترع شرطًا أو إجراءً أو موعدًا أو رقمًا أو جهة غير موجودة في المرجع أو التقرير.";
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
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/lookup_request_status`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ p_request_number: requestNumber }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { protected: true, text: "تعذر التحقق من صلاحية الاستعلام عن حالة الطلب." };
  const item = Array.isArray(data) ? data[0] : data;
  if (!item) return { protected: true, text: `لم أجد طلبًا بالرقم ${requestNumber} ضمن التقارير المرتبطة بمدرستك.` };
  return { protected: true, text: [`حالة الطلب رقم ${item.request_number}: ${item.status || "غير محددة"}.`, item.service ? `الخدمة: ${item.service}.` : "", item.status_date ? `تاريخ الحالة: ${item.status_date}.` : "", item.notes ? `ملاحظات: ${item.notes}.` : ""].filter(Boolean).join(" ") };
}

async function speakReply(reply) {
  if (!AZURE_SPEECH_KEY) return null;
  let ttsResponse = await synthesize(buildSsml(reply, true));
  if (!ttsResponse) ttsResponse = await synthesize(buildSsml(reply, false));
  return ttsResponse;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return NextResponse.json({ error: "الرسالة مطلوبة" }, { status: 400 });

    const requestStatus = await lookupRequestStatus(message, request);
    if (requestStatus?.protected && requestStatus.text.includes("حالة الطلب رقم")) {
      const reply = requestStatus.text;
      const audio = await speakReply(reply);
      return NextResponse.json({ reply, audio, audioType: audio ? "audio/mpeg" : null });
    }

    const matches = await searchKnowledgeFromSupabase(message);
    const periodicContext = "";
    const enrichedMessage = [
      "طلب المستفيد:", message, "",
      "مرجع قاعدة المعرفة الرسمية من Supabase، ويشمل التقارير المدرسية المنشورة والمعتمدة:", buildKnowledgeContext(matches),
      periodicContext, "",
      "تعليمات الإجابة:", buildResponseInstructions(message), "",
      "قاعدة عامة:", "استخدم الحقائق الموجودة في المرجع المنشور. إذا لم تتوفر المعلومة، صرّح بذلك بوضوح بدل اختراع معلومات. لا تطلب تسجيل الدخول للوصول إلى التقارير المنشورة والمعتمدة.",
    ].join("\n");

    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ message: enrichedMessage, user_message: message }),
      cache: "no-store",
    });
    if (!n8nResponse.ok) return NextResponse.json({ error: "تعذر الاتصال بالمساعد التعليمي" }, { status: 502 });

    const contentType = n8nResponse.headers.get("content-type") || "";
    let n8nData;
    if (contentType.includes("application/json")) {
      n8nData = await n8nResponse.json();
    } else {
      n8nData = {};
    }

    const reply = String(n8nData?.reply ?? n8nData?.output ?? "").trim();
    if (!reply) return NextResponse.json({ error: "لم يصل رد من المساعد" }, { status: 502 });

    // إذا أصبح n8n يعيد الصوت مع الرد، نمرره مباشرة دون إعادة توليده في Vercel.
    const n8nAudio = typeof n8nData?.audio === "string" && n8nData.audio.length > 0 ? n8nData.audio : null;
    if (n8nAudio) {
      return NextResponse.json({
        reply,
        audio: n8nAudio,
        audioType: n8nData?.audioType || "audio/mpeg",
      });
    }

    // توافق مرحلي: إلى أن يتم تفعيل إخراج الصوت من n8n، يبقى التوليد المحلي كحل احتياطي.
    const audio = await speakReply(reply);
    return NextResponse.json({ reply, audio, audioType: audio ? "audio/mpeg" : null });
  } catch (error) {
    console.error("[chat] Unexpected error:", error);
    return NextResponse.json({ error: "تعذر معالجة الطلب حاليًا" }, { status: 500 });
  }
}
