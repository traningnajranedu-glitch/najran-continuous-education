"use client";

import { useEffect, useMemo, useState } from "react";

function normalize(value) { return String(value ?? "").trim(); }

function formatDate(value) {
  const text = normalize(value);
  if (!text) return "—";
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text;
  return d.toLocaleDateString("ar-SA", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function SchoolReportsPage() {
  const [session, setSession] = useState(null);
  const [school, setSchool] = useState(null);
  const [reports, setReports] = useState([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);

  const filtered = useMemo(() => reports, [reports]);

  async function login(e) {
    e.preventDefault();
    setLoggingIn(true); setMsg("");
    try {
      const response = await fetch("/api/schools/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر تسجيل الدخول.");
      setSession({ access_token: data.access_token });
      setSchool(data.school);
    } catch (error) {
      setSession(null); setSchool(null);
      setMsg(error?.message || "تعذر تسجيل الدخول.");
    } finally { setLoggingIn(false); }
  }

  async function loadReports(activeSession = session, activeSearch = search) {
    if (!activeSession?.access_token) return;
    setBusy(true); setMsg("");
    try {
      const params = new URLSearchParams();
      if (activeSearch.trim()) params.set("search", activeSearch.trim());
      params.set("limit", "500");
      const response = await fetch(`/api/schools/reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${activeSession.access_token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "تعذر قراءة التقارير.");
      setSchool(data.school);
      setReports(Array.isArray(data.reports) ? data.reports : []);
    } catch (error) {
      setMsg(error?.message || "تعذر قراءة التقارير.");
    } finally { setBusy(false); }
  }

  useEffect(() => {
    if (session) loadReports(session, "");
  }, [session]);

  function logout() {
    setSession(null); setSchool(null); setReports([]); setEmail(""); setPassword(""); setSearch(""); setMsg("");
  }

  if (!session || !school) {
    return (
      <main className="shell" dir="rtl">
        <section className="card" style={{ maxWidth: 520 }}>
          <div className="section-label">بوابة المدارس الآمنة</div>
          <div className="page-heading">
            <div><h1>التقارير وحالات الطلبات</h1><p>تسجيل الدخول لعرض آخر التقارير وحالات الطلبات الخاصة بالمدرسة.</p></div>
            <div className="heading-mark">AI</div>
          </div>
          <form onSubmit={login} style={{ display: "grid", gap: 12, marginTop: 22 }}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني" required />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور" required />
            <button disabled={loggingIn}>{loggingIn ? "جارٍ التحقق..." : "دخول آمن"}</button>
          </form>
          {msg && <div className="notice" style={{ marginTop: 16 }}>{msg}</div>}
        </section>
      </main>
    );
  }

  return (
    <main className="shell" dir="rtl">
      <section className="card" style={{ maxWidth: 1220 }}>
        <div className="page-heading">
          <div>
            <div className="section-label">بوابة المدارس</div>
            <h1>آخر التقارير وحالات الطلبات</h1>
            <p>المدرسة: <strong>{school.name}</strong> · {school.code}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <a href="/schools" className="secondary" style={{ textDecoration: "none", padding: "10px 14px", borderRadius: 12 }}>رفع تقرير</a>
            <button className="secondary" type="button" onClick={logout}>خروج</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") loadReports(session, search); }}
            placeholder="ابحث برقم الطلب أو اسم المستفيد"
            style={{ flex: 1, minWidth: 280 }}
          />
          <button type="button" onClick={() => loadReports(session, search)} disabled={busy}>{busy ? "جارٍ التحميل..." : "بحث"}</button>
          <button className="secondary" type="button" onClick={() => { setSearch(""); loadReports(session, ""); }} disabled={busy}>عرض الكل</button>
        </div>

        {msg && <div className="notice" style={{ marginTop: 16 }}>{msg}</div>}

        <div className="notice" style={{ marginTop: 16 }}>
          <strong>{filtered.length}</strong> سجل معروض · الترتيب من الأحدث إلى الأقدم.
        </div>

        <div className="tableWrap" style={{ marginTop: 18 }}>
          <table>
            <thead>
              <tr>
                <th>رقم الطلب</th>
                <th>اسم المستفيد</th>
                <th>الخدمة</th>
                <th>الحالة</th>
                <th>تاريخ الحالة</th>
                <th>تاريخ التقرير</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: "center", padding: 30 }}>لا توجد تقارير أو طلبات مطابقة.</td></tr>
              ) : filtered.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.request_number}</strong></td>
                  <td>{item.applicant_name || "—"}</td>
                  <td>{item.service || "—"}</td>
                  <td>{item.status || "—"}</td>
                  <td>{formatDate(item.status_date)}</td>
                  <td>{formatDate(item.report_date)}</td>
                  <td>{item.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 20, padding: 16, borderRadius: 16, background: "#f6faf8", lineHeight: 1.9 }}>
          <strong>ملاحظة</strong>
          <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
            تظهر هنا بيانات المدرسة الحالية فقط. يمكن استخدام البحث للوصول السريع إلى رقم الطلب أو اسم المستفيد.
          </div>
        </div>
      </section>
    </main>
  );
}
