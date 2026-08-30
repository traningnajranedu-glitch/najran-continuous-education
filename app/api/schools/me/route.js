import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.KNOWLEDGE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.KNOWLEDGE_SUPABASE_SERVICE_ROLE_KEY;

export async function GET(request) {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return NextResponse.json({ error: "إعدادات Supabase غير مكتملة على الخادم." }, { status: 500 });
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return NextResponse.json({ error: "يلزم تسجيل الدخول." }, { status: 401 });

    const client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData?.user) return NextResponse.json({ error: "جلسة الدخول غير صالحة." }, { status: 401 });

    const { data: member, error: memberError } = await client
      .from("school_members")
      .select("school_id, role, active, schools!inner(id,name,code,active)")
      .eq("user_id", userData.user.id)
      .eq("active", true)
      .maybeSingle();

    if (memberError) return NextResponse.json({ error: "تعذر التحقق من عضوية المدرسة." }, { status: 500 });
    if (!member || !member.schools?.active) return NextResponse.json({ error: "لا توجد مدرسة مفعلة مرتبطة بهذا الحساب." }, { status: 403 });

    return NextResponse.json({
      user: { id: userData.user.id, email: userData.user.email || null },
      school: { id: member.schools.id, name: member.schools.name, code: member.schools.code },
      role: member.role,
    });
  } catch (error) {
    return NextResponse.json({ error: error?.message || "تعذر التحقق من الحساب." }, { status: 500 });
  }
}
