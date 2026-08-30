import { NextResponse } from "next/server";

const SUPABASE_URL = "https://cbqtmssmnetbnuohnacz.supabase.co";
const ANON_KEY = "sb_publishable_6nHVWHU7JzUVkxBzavXdYQ_s-uR4kE7";

async function publicAuth(options = {}) {
  return fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    ...options,
    headers: {
      apikey: ANON_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
}

async function rpc(path, accessToken) {
  return fetch(`${SUPABASE_URL}${path}`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: "{}",
    cache: "no-store",
  });
}

async function readJson(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!email || !password) return NextResponse.json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان." }, { status: 400 });

    const authResponse = await publicAuth({ method: "POST", body: JSON.stringify({ email, password }) });
    const authData = await readJson(authResponse);
    if (!authResponse.ok || !authData?.access_token || !authData?.user?.id) {
      return NextResponse.json({ error: authData?.error_description || authData?.msg || "بيانات الدخول غير صحيحة." }, { status: 401 });
    }

    const membershipResponse = await rpc("/rest/v1/rpc/get_my_school_membership", authData.access_token);
    const membershipData = await readJson(membershipResponse);
    if (!membershipResponse.ok) return NextResponse.json({ error: "تعذر التحقق من عضوية المدرسة للحساب." }, { status: 500 });
    const member = Array.isArray(membershipData) ? membershipData[0] : membershipData;
    if (!member?.school_id) return NextResponse.json({ error: "لم يتم العثور على عضوية مدرسة فعالة لهذا الحساب." }, { status: 403 });

    const response = NextResponse.json({
      access_token: authData.access_token,
      refresh_token: authData.refresh_token || null,
      expires_in: authData.expires_in || null,
      user: { id: authData.user.id, email: authData.user.email || email },
      school: { id: member.school_id, name: member.school_name, code: member.school_code },
      role: member.role,
    });
    response.cookies.set("school_access_token", authData.access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: Number(authData.expires_in || 3600),
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error?.message || "تعذر تسجيل الدخول حاليًا." }, { status: 500 });
  }
}
