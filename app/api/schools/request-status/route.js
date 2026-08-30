import { NextResponse } from "next/server";

const SUPABASE_URL = "https://cbqtmssmnetbnuohnacz.supabase.co";
const ANON_KEY = "sb_publishable_6nHVWHU7JzUVkxBzavXdYQ_s-uR4kE7";

function clean(value) { return String(value ?? "").trim(); }

async function callRpc(name, body, accessToken) {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

async function readJson(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!accessToken) {
      return NextResponse.json({ error: "يلزم تسجيل الدخول." }, { status: 401 });
    }

    const body = await request.json();
    const fileName = clean(body?.fileName) || "excel-report";
    const reportDate = clean(body?.reportDate) || new Date().toISOString().slice(0, 10);
    const rows = Array.isArray(body?.rows) ? body.rows : [];

    if (!rows.length) return NextResponse.json({ error: "لا توجد سجلات في التقرير." }, { status: 400 });
    if (rows.length > 5000) return NextResponse.json({ error: "الحد الأقصى للرفع الواحد 5000 سجل." }, { status: 400 });

    const payload = rows.map((row) => ({
      request_number: clean(row?.request_number),
      applicant_name: clean(row?.applicant_name),
      service: clean(row?.service),
      status: clean(row?.status),
      status_date: clean(row?.status_date),
      notes: clean(row?.notes),
    }));

    const response = await callRpc(
      "submit_request_status_report",
      { p_report_date: reportDate, p_file_name: fileName, p_rows: payload },
      accessToken,
    );
    const result = await readJson(response);

    if (!response.ok) {
      const message = result?.message || result?.error || "تعذر اعتماد التقرير.";
      if (String(message).includes("NO_ACTIVE_SCHOOL")) {
        return NextResponse.json({ error: "لا توجد مدرسة مفعلة مرتبطة بهذا الحساب." }, { status: 403 });
      }
      if (String(message).includes("NO_UPLOAD_PERMISSION")) {
        return NextResponse.json({ error: "ليس لديك صلاحية رفع تقارير المدرسة." }, { status: 403 });
      }
      if (String(message).includes("EMPTY_REPORT")) {
        return NextResponse.json({ error: "لا توجد سجلات في التقرير." }, { status: 400 });
      }
      if (String(message).includes("REPORT_TOO_LARGE")) {
        return NextResponse.json({ error: "الحد الأقصى للرفع الواحد 5000 سجل." }, { status: 400 });
      }
      if (String(message).includes("NO_VALID_ROWS")) {
        return NextResponse.json({ error: "لم يتم العثور على سجلات صالحة. يجب أن يحتوي كل سجل على رقم الطلب والحالة." }, { status: 400 });
      }
      return NextResponse.json({ error: message }, { status: response.status || 500 });
    }

    return NextResponse.json({
      ok: true,
      count: Number(result?.count || 0),
      reportDate,
      message: "تم اعتماد التقرير وحفظه بنجاح.",
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "تعذر حفظ التقرير حاليًا." }, { status: 500 });
  }
}
