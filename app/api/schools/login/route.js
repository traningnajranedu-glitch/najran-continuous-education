import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.KNOWLEDGE_SUPABASE_URL || "https://cbqtmssmnetbnuohnacz.supabase.co";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_6nHVWHU7JzUVkxBzavXdYQ_s-uR4kE7";
const SERVICE_ROLE_KEY = process.env.KNOWLEDGE_SUPABASE_SERVICE_ROLE_KEY;

async function supabaseFetch(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: ANON_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    cache: "no-store",
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  return { response, data };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!email || !password) return NextResponse.json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان." }, { status: 400 });
    if (!SERVICE_ROLE_KEY) return NextResponse.json({ error: "إعدادات قاعدة المعرفة غير مكتملة على الخادم." }, { status: 500 });

    const { response: authResponse, data: authData } = await supabaseFetch(`/auth/v1/token?grant_type=password`, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (!authResponse.ok || !authData?.access_token || !authData?.user?.id) {
      return NextResponse.json({ error: authData?.error_description || authData?.msg || "بيانات الدخول غير صحيحة." }, { status: 401 });
    }

    const userId = authData.user.id;
    const memberResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/school_members?select=school_id,role,active,schools!inner(id,name,code,active)&user_id=eq.${encodeURIComponent(userId)}&active=eq.true&schools.active=eq.true&limit=1`,
      {
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        cache: "no-store",
      },
    );
    const members = await memberResponse.json();
    const member = members?.[0];
    if (!member) return NextResponse.json({ error: "لا توجد مدرسة مفعلة مرتبطة بهذا الحساب." }, { status: 403 });

    return NextResponse.json({
      access_token: authData.access_token,
      refresh_token: authData.refresh_token || null,
      expires_in: authData.expires_in || null,
      user: { id: userId, email: authData.user.email || email },
      school: { id: member.schools.id, name: member.schools.name, code: member.schools.code },
      role: member.role,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "تعذر تسجيل الدخول حاليًا." }, { status: 500 });
  }
}
