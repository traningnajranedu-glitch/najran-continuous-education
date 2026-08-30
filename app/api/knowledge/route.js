import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.KNOWLEDGE_SUPABASE_URL || "https://cbqtmssmnetbnuohnacz.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.KNOWLEDGE_SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_PASSWORD = process.env.KNOWLEDGE_ADMIN_PASSWORD;

function unauthorized() {
  return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
}

function headers(includeJson = false) {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY || "",
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY || ""}`,
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
  };
}

function authorized(request) {
  return Boolean(ADMIN_PASSWORD && request.headers.get("x-admin-password") === ADMIN_PASSWORD);
}

export async function GET(request) {
  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "لم يتم إعداد مفتاح قاعدة المعرفة على الخادم" }, { status: 500 });
    const params = new URL(request.url).searchParams;
    const q = params.get("q")?.trim();
    const service = params.get("service")?.trim();
    const status = params.get("status")?.trim();
    const parts = ["select=*", "order=updated_at.desc"];
    if (q) parts.push(`or=(title.ilike.*${encodeURIComponent(q)}*,content.ilike.*${encodeURIComponent(q)}*,service.ilike.*${encodeURIComponent(q)}*)`);
    if (service) parts.push(`service=eq.${encodeURIComponent(service)}`);
    if (status) parts.push(`status=eq.${encodeURIComponent(status)}`);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base?${parts.join("&")}`, {
      headers: headers(),
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: "تعذر قراءة قاعدة المعرفة", details: data }, { status: 502 });
    return NextResponse.json({ rows: data });
  } catch {
    return NextResponse.json({ error: "تعذر قراءة قاعدة المعرفة" }, { status: 500 });
  }
}

export async function POST(request) {
  if (!authorized(request)) return unauthorized();
  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "لم يتم إعداد مفتاح قاعدة المعرفة على الخادم" }, { status: 500 });
    const payload = await request.json();
    const row = {
      title: String(payload.title || "").trim(),
      category: String(payload.category || "عام").trim(),
      service: payload.service ? String(payload.service).trim() : null,
      content: String(payload.content || "").trim(),
      keywords: Array.isArray(payload.keywords) ? payload.keywords.map(String).map((x) => x.trim()).filter(Boolean) : [],
      source_url: payload.source_url ? String(payload.source_url).trim() : null,
      document_url: payload.document_url ? String(payload.document_url).trim() : null,
      status: ["active", "inactive", "draft"].includes(payload.status) ? payload.status : "draft",
      verified_at: payload.verified_at || null,
    };
    if (!row.title || !row.content) return NextResponse.json({ error: "العنوان والمحتوى مطلوبان" }, { status: 400 });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base`, {
      method: "POST",
      headers: { ...headers(true), Prefer: "return=representation" },
      body: JSON.stringify(row),
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: "تعذر حفظ المادة", details: data }, { status: 502 });
    return NextResponse.json({ row: data[0] });
  } catch {
    return NextResponse.json({ error: "تعذر حفظ المادة" }, { status: 500 });
  }
}

export async function PATCH(request) {
  if (!authorized(request)) return unauthorized();
  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "لم يتم إعداد مفتاح قاعدة المعرفة على الخادم" }, { status: 500 });
    const payload = await request.json();
    const id = String(payload.id || "").trim();
    if (!id) return NextResponse.json({ error: "المعرف مطلوب" }, { status: 400 });
    const allowed = ["title", "category", "service", "content", "keywords", "source_url", "document_url", "status", "verified_at"];
    const patch = Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.includes(key)));
    if (patch.status && !["active", "inactive", "draft"].includes(patch.status)) return NextResponse.json({ error: "حالة غير صالحة" }, { status: 400 });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { ...headers(true), Prefer: "return=representation" },
      body: JSON.stringify(patch),
    });
    const data = await response.json();
    if (!response.ok) return NextResponse.json({ error: "تعذر تحديث المادة", details: data }, { status: 502 });
    return NextResponse.json({ row: data[0] });
  } catch {
    return NextResponse.json({ error: "تعذر تحديث المادة" }, { status: 500 });
  }
}

export async function DELETE(request) {
  if (!authorized(request)) return unauthorized();
  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "لم يتم إعداد مفتاح قاعدة المعرفة على الخادم" }, { status: 500 });
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "المعرف مطلوب" }, { status: 400 });
    const response = await fetch(`${SUPABASE_URL}/rest/v1/knowledge_base?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { ...headers(true), Prefer: "return=minimal" },
    });
    if (!response.ok) {
      const data = await response.text();
      return NextResponse.json({ error: "تعذر حذف المادة", details: data }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "تعذر حذف المادة" }, { status: 500 });
  }
}
