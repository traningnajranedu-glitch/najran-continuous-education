import { NextResponse } from "next/server";

const SUPABASE_URL = "https://cbqtmssmnetbnuohnacz.supabase.co";
const ANON_KEY = "sb_publishable_6nHVWHU7JzUVkxBzavXdYQ_s-uR4kE7";
const SERVICE_ROLE_KEY = process.env.KNOWLEDGE_SUPABASE_SERVICE_ROLE_KEY;

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

async function adminGet(path) {
  if (!SERVICE_ROLE_KEY) throw new Error("إعدادات قاعدة المعرفة غير مكتملة على الخادم.");
  return fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Accept: "application/json",
    },
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
    if (!email || !password) {
      return NextResponse.json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان." }, { status: 400 });
    }
    if (!SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "إعدادات قاعدة المعرفة غير مكتملة على الخادم." }, { status: 500 });
    }

    const authResponse = await publicAuth({
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const authData = await readJson(authResponse);

    if (!authResponse.ok || !authData?.access_token || !authData?.user?.id) {
      return NextResponse.json(
        { error: authData?.error_description || authData?.msg || "بيانات الدخول غير صحيحة." },
        { status: 401 },
      );
    }

    const userId = authData.user.id;
    const memberResponse = await adminGet(
      `/rest/v1/school_members?select=school_id,role,active&user_id=eq.${encodeURIComponent(userId)}&active=eq.true&limit=1`,
    );
    const members = await readJson(memberResponse);

    if (!memberResponse.ok) {
      return NextResponse.json({
        error: "تعذر قراءة عضوية المدرسة للحساب.",
        stage: "school_members",
        status: memberResponse.status,
      }, { status: 500 });
    }

    const member = Array.isArray(members) ? members[0] : null;
    if (!member) {
      return NextResponse.json({
        error: "لم يتم العثور على عضوية مدرسة فعالة لهذا الحساب.",
        stage: "membership_not_found",
        authenticated_user_id: userId,
      }, { status: 403 });
    }

    const schoolResponse = await adminGet(
      `/rest/v1/schools?select=id,name,code,active&id=eq.${encodeURIComponent(member.school_id)}&active=eq.true&limit=1`,
    );
    const schools = await readJson(schoolResponse);

    if (!schoolResponse.ok) {
      return NextResponse.json({
        error: "تعذر قراءة بيانات المدرسة.",
        stage: "schools",
        status: schoolResponse.status,
      }, { status: 500 });
    }

    const school = Array.isArray(schools) ? schools[0] : null;
    if (!school) {
      return NextResponse.json({
        error: "تم العثور على العضوية، لكن المدرسة نفسها غير فعالة أو غير موجودة.",
        stage: "school_not_found",
      }, { status: 403 });
    }

    return NextResponse.json({
      access_token: authData.access_token,
      refresh_token: authData.refresh_token || null,
      expires_in: authData.expires_in || null,
      user: { id: userId, email: authData.user.email || email },
      school: { id: school.id, name: school.name, code: school.code },
      role: member.role,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "تعذر تسجيل الدخول حاليًا.", stage: "server_error" }, { status: 500 });
  }
}
