import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.KNOWLEDGE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.KNOWLEDGE_SUPABASE_SERVICE_ROLE_KEY;

function clean(value) {
  return String(value ?? "").trim();
}

async function supabase(path, options = {}) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("إعدادات قاعدة المعرفة غير مكتملة على الخادم.");
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) throw new Error(data?.message || data?.hint || "تعذر الاتصال بقاعدة البيانات.");
  return data;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const schoolName = clean(body?.schoolName);
    const schoolCode = clean(body?.schoolCode);
    const fileName = clean(body?.fileName) || "excel-report";
    const rows = Array.isArray(body?.rows) ? body.rows : [];

    if (!schoolName || !schoolCode) return NextResponse.json({ error: "اسم المدرسة ورمز المدرسة مطلوبان." }, { status: 400 });
    if (!rows.length) return NextResponse.json({ error: "لا توجد سجلات في التقرير." }, { status: 400 });
    if (rows.length > 5000) return NextResponse.json({ error: "الحد الأقصى للملف 5000 سجل في الرفع الواحد." }, { status: 400 });

    const schools = await supabase(`schools?select=id,name,code,active&code=eq.${encodeURIComponent(schoolCode)}&limit=1`);
    const school = schools?.[0];
    if (!school || !school.active || school.name !== schoolName) {
      return NextResponse.json({ error: "بيانات المدرسة غير صحيحة أو المدرسة غير مفعلة." }, { status: 403 });
    }

    const reportDate = clean(body?.reportDate) || new Date().toISOString().slice(0, 10);
    const payload = rows.map((row) => ({
      school_id: school.id,
      report_date: reportDate,
      request_number: clean(row.request_number),
      applicant_name: clean(row.applicant_name),
      service: clean(row.service),
      status: clean(row.status),
      status_date: clean(row.status_date) || null,
      notes: clean(row.notes),
      source_file_name: fileName,
      uploaded_by: null,
    })).filter(r => r.request_number && r.status);

    if (!payload.length) return NextResponse.json({ error: "لم يتم العثور على سجلات صالحة. يجب أن يحتوي كل سجل على رقم الطلب والحالة." }, { status: 400 });

    const saved = await supabase("request_status_reports?on_conflict=school_id,report_date,request_number", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(payload),
    });

    return NextResponse.json({ ok: true, count: Array.isArray(saved) ? saved.length : payload.length, school: school.name, reportDate });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "تعذر حفظ التقرير حاليًا." }, { status: 500 });
  }
}
