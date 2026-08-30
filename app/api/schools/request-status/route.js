import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.KNOWLEDGE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.KNOWLEDGE_SUPABASE_SERVICE_ROLE_KEY;

function clean(value) { return String(value ?? "").trim(); }

async function getAuthorizedMember(request) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("إعدادات Supabase غير مكتملة على الخادم.");
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return { error: "يلزم تسجيل الدخول.", status: 401 };

  const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData?.user) return { error: "جلسة الدخول غير صالحة.", status: 401 };

  const { data: member, error: memberError } = await client
    .from("school_members")
    .select("school_id, role, active, schools!inner(id,name,code,active)")
    .eq("user_id", userData.user.id)
    .eq("active", true)
    .maybeSingle();

  if (memberError) return { error: "تعذر التحقق من عضوية المدرسة.", status: 500 };
  if (!member || !member.schools?.active) return { error: "لا توجد مدرسة مفعلة مرتبطة بهذا الحساب.", status: 403 };
  if (!["school_admin", "teacher"].includes(member.role)) return { error: "ليس لديك صلاحية رفع تقارير المدرسة.", status: 403 };

  return { userId: userData.user.id, member, client };
}

export async function POST(request) {
  try {
    const auth = await getAuthorizedMember(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const fileName = clean(body?.fileName) || "excel-report";
    const reportDate = clean(body?.reportDate) || new Date().toISOString().slice(0, 10);
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length) return NextResponse.json({ error: "لا توجد سجلات في التقرير." }, { status: 400 });
    if (rows.length > 5000) return NextResponse.json({ error: "الحد الأقصى للرفع الواحد 5000 سجل." }, { status: 400 });

    const school = auth.member.schools;
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
      uploaded_by: auth.userId,
    })).filter((r) => r.request_number && r.status);

    if (!payload.length) return NextResponse.json({ error: "لم يتم العثور على سجلات صالحة. يجب أن يحتوي كل سجل على رقم الطلب والحالة." }, { status: 400 });

    const { data, error } = await auth.client
      .from("request_status_reports")
      .upsert(payload, { onConflict: "school_id,report_date,request_number", ignoreDuplicates: false })
      .select("id");

    if (error) return NextResponse.json({ error: error.message || "تعذر حفظ التقرير." }, { status: 500 });
    return NextResponse.json({ ok: true, count: Array.isArray(data) ? data.length : payload.length, school: school.name, reportDate });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "تعذر حفظ التقرير حاليًا." }, { status: 500 });
  }
}
