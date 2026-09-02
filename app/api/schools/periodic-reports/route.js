import { NextResponse } from "next/server";
import { classifyReport } from "@/lib/report-classifier";

const SUPABASE_URL = "https://cbqtmssmnetbnuohnacz.supabase.co";
const ANON_KEY = "sb_publishable_6nHVWHU7JzUVkxBzavXdYQ_s-uR4kE7";

function authToken(request) {
  const h = request.headers.get("authorization") || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
}

async function readJson(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

async function membership(token) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_my_school_membership`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: "{}",
    cache: "no-store",
  });
  const data = await readJson(response);
  if (!response.ok) return { error: "تعذر التحقق من عضوية المدرسة.", status: 500 };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.school_id) return { error: "لا توجد مدرسة مفعلة مرتبطة بهذا الحساب.", status: 403 };
  if (!["school_admin", "teacher"].includes(row.role)) return { error: "ليس لديك صلاحية تحديث تقارير المدرسة.", status: 403 };
  return row;
}

export async function GET(request) {
  try {
    const token = authToken(request);
    if (!token) return NextResponse.json({ error: "يلزم تسجيل الدخول." }, { status: 401 });
    const member = await membership(token);
    if (member.error) return NextResponse.json({ error: member.error }, { status: member.status });

    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const params = new URLSearchParams({ select: "id,school_id,report_type,report_subtype,detected_report_type,classification_confidence,validation_status,validation_issues,detected_columns,report_metrics,report_date,title,summary,report_data,source_file_name,status,reported_by,created_at", school_id: `eq.${member.school_id}`, status: "eq.approved", order: "report_date.desc,created_at.desc", limit: "200" });
    if (type) params.set("report_type", `eq.${encodeURIComponent(type)}`);
    const response = await fetch(`${SUPABASE_URL}/rest/v1/school_periodic_reports?${params.toString()}`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    const reports = await readJson(response);
    if (!response.ok) return NextResponse.json({ error: reports?.message || "تعذر قراءة التقارير." }, { status: response.status || 500 });
    return NextResponse.json({ school: { id: member.school_id, name: member.school_name, code: member.school_code }, reports: Array.isArray(reports) ? reports : [] });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "تعذر قراءة التقارير." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const token = authToken(request);
    if (!token) return NextResponse.json({ error: "يلزم تسجيل الدخول." }, { status: 401 });
    const member = await membership(token);
    if (member.error) return NextResponse.json({ error: member.error }, { status: member.status });

    const body = await request.json();
    const allowed = ["students", "teachers", "environment", "activities", "requests"];
    const reportType = String(body?.reportType || "").trim();
    const reportDate = String(body?.reportDate || "").trim();
    const title = String(body?.title || "").trim();
    const summary = String(body?.summary || "").trim();
    const fileName = String(body?.fileName || "").trim();
    const reportData = Array.isArray(body?.reportData) ? body.reportData : [];
    const confirm = body?.confirm === true;

    if (!allowed.includes(reportType)) return NextResponse.json({ error: "نوع التقرير غير صالح." }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reportDate)) return NextResponse.json({ error: "تاريخ التقرير غير صالح." }, { status: 400 });
    if (!reportData.length) return NextResponse.json({ error: "لم يحتوي التقرير على سجلات." }, { status: 400 });
    if (reportData.length > 5000) return NextResponse.json({ error: "الحد الأقصى للرفع الواحد 5000 سجل." }, { status: 400 });

    const validation = classifyReport({ title, summary, fileName, reportType, rows: reportData });

    // Do not approve a mismatched report unless the uploader explicitly confirms the AI recommendation.
    if (validation.mismatch && !confirm) {
      return NextResponse.json({
        ok: false,
        requiresConfirmation: true,
        error: "تم اكتشاف عدم توافق بين نوع التقرير المختار ومحتوى البيانات.",
        validation,
      }, { status: 422 });
    }

    const finalType = validation.detectedType === "unknown" ? reportType : validation.detectedType;
    const finalSubtype = validation.detectedType === "teachers" && /ترشيح|مرشح|غير مرشح/i.test(`${title} ${summary} ${fileName}`) ? "nomination" : validation.detectedType === "requests" ? "service_requests" : null;
    const validationStatus = validation.issues.length || validation.mismatch ? "warning" : "passed";

    const response = await fetch(`${SUPABASE_URL}/rest/v1/school_periodic_reports`, {
      method: "POST",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json", Prefer: "return=representation" },
      body: JSON.stringify({
        school_id: member.school_id,
        report_type: finalType,
        report_subtype: finalSubtype,
        detected_report_type: validation.detectedType,
        classification_confidence: validation.confidence,
        validation_status: validationStatus,
        validation_issues: validation.issues,
        detected_columns: validation.columns,
        report_metrics: validation.metrics,
        report_date: reportDate,
        title: title || null,
        summary: summary || null,
        report_data: reportData,
        source_file_name: fileName || null,
        status: "approved",
        reported_by: member.user_id || null,
      }),
      cache: "no-store",
    });
    const data = await readJson(response);
    if (!response.ok) return NextResponse.json({ error: data?.message || "تعذر حفظ التقرير." }, { status: response.status || 500 });
    return NextResponse.json({ ok: true, school: member.school_name, validation, report: Array.isArray(data) ? data[0] : data });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "تعذر حفظ التقرير." }, { status: 500 });
  }
}
