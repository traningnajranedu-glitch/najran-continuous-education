import { NextResponse } from "next/server";

const SUPABASE_URL = "https://cbqtmssmnetbnuohnacz.supabase.co";
const ANON_KEY = "sb_publishable_6nHVWHU7JzUVkxBzavXdYQ_s-uR4kE7";

function clean(value) { return String(value ?? "").trim(); }

async function readJson(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

async function callRpc(name, accessToken, body = {}) {
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

export async function GET(request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!accessToken) return NextResponse.json({ error: "يلزم تسجيل الدخول." }, { status: 401 });

    const url = new URL(request.url);
    const search = clean(url.searchParams.get("search"));
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 500);

    const membershipResponse = await callRpc("get_my_school_membership", accessToken);
    const membershipData = await readJson(membershipResponse);
    if (!membershipResponse.ok) {
      return NextResponse.json({ error: "تعذر التحقق من عضوية المدرسة." }, { status: 500 });
    }

    const member = Array.isArray(membershipData) ? membershipData[0] : membershipData;
    if (!member?.school_id) {
      return NextResponse.json({ error: "لم يتم العثور على عضوية مدرسة فعالة لهذا الحساب." }, { status: 403 });
    }

    let query = `${SUPABASE_URL}/rest/v1/request_status_reports?select=id,report_date,request_number,applicant_name,service,status,status_date,notes,source_file_name,created_at&school_id=eq.${encodeURIComponent(member.school_id)}&order=report_date.desc,created_at.desc&limit=${limit}`;
    if (search) {
      const encoded = encodeURIComponent(`%${search}%`);
      query += `&or=(request_number.ilike.${encoded},applicant_name.ilike.${encoded})`;
    }

    const response = await fetch(query, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const data = await readJson(response);

    if (!response.ok) return NextResponse.json({ error: data?.message || data?.hint || "تعذر قراءة التقارير." }, { status: response.status });

    return NextResponse.json({
      school: { id: member.school_id, name: member.school_name, code: member.school_code },
      reports: Array.isArray(data) ? data : [],
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "تعذر قراءة التقارير حاليًا." }, { status: 500 });
  }
}
