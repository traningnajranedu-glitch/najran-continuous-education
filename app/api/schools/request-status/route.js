import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://cbqtmssmnetbnuohnacz.supabase.co";
const ANON_KEY = process.env.KNOWLEDGE_SUPABASE_ANON_KEY || process.env.KNOWLEDGE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_6nHVWHU7JzUVkxBzavXdYQ_s-uR4kE7";

function clean(value) { return String(value ?? "").trim(); }

async function getAuthorizedMember(request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return { error: "يلزم تسجيل الدخول.", status: 401 };

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData?.user) return { error: "جلسة الدخول غير صالحة.", status: 401 };

  const { data: member, error: memberError } = await client
    .from("school_members")
    .select("school_id, role, active")
    .eq("user_id", userData.user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (memberError) return { error: memberError.message || "تعذر قراءة عضوية المدرسة.", status: 500 };
  if (!member) return { error: "لا توجد مدرسة مفعلة مرتبطة بهذا الحساب.", status: 403 };
  if (!["school_admin", "teacher"].includes(member.role)) {
    return { error: "ليس لديك صلاحية رفع تقارير المدرسة.", status: 403 };
  }

  const { data: school, error: schoolError } = await client
    .from("schools")
    .select("id,name,code,active")
    .eq("id", member.school_id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (schoolError) return { error: schoolError.message || "تعذر قراءة بيانات المدرسة.", status: 500 };
  if (!school) return { error: "المدرسة المرتبطة بالحساب غير مفعلة.", status: 403 };

  return { userId: userData.user.id, member, school, client };
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

    const payload = rows
      .map((row) => ({
        school_id: auth.school.id,
        report_date: reportDate,
        request_number: clean(row.request_number),
        applicant_name: clean(row.applicant_name),
        service: clean(row.service),
        status: clean(row.status),
        status_date: clean(row.status_date) || null,
        notes: clean(row.notes),
        source_file_name: fileName,
        uploaded_by: auth.userId,
      }))
      .filter((r) => r.request_number && r.status);

    if (!payload.length) {
      return NextResponse.json({
        error: "لم يتم العثور على سجلات صالحة. يجب أن يحتوي كل سجل على رقم الطلب والحالة.",
      }, { status: 400 });
    }

    const { data, error } = await auth.client
      .from("request_status_reports")
      .upsert(payload, { onConflict: "school_id,report_date,request_number", ignoreDuplicates: false })
      .select("id");

    if (error) return NextResponse.json({ error: error.message || "تعذر حفظ التقرير." }, { status: 500 });
    return NextResponse.json({
      ok: true,
      count: Array.isArray(data) ? data.length : payload.length,
      school: auth.school.name,
      reportDate,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "تعذر حفظ التقرير حاليًا." }, { status: 500 });
  }
}
