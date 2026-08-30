"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

function normalize(v) { return String(v ?? "").trim(); }

function normalizeDate(value) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const text = normalize(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return text;
}

function mapRows(rows) {
  return rows.map((r, i) => ({
    id: i + 1,
    request_number: normalize(r["رقم الطلب"] || r["request_number"] || r["رقم الطلبة"]),
    applicant_name: normalize(r["اسم المستفيد"] || r["اسم الطالب"] || r["applicant_name"]),
    service: normalize(r["الخدمة"] || r["service"]),
    status: normalize(r["الحالة"] || r["status"]),
    status_date: normalizeDate(r["تاريخ الحالة"] || r["status_date"]),
    notes: normalize(r["ملاحظات"] || r["notes"]),
  }));
}

export default function SchoolsPortal() {
  const [session, setSession] = useState(null);
  const [school, setSchool] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const mapped = useMemo(() => mapRows(rows), [rows]);

  async function login(e) {
    e.preventDefault(); setLoggingIn(true); setMsg("");
    try {
      const response = await fetch("/api/schools/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "تعذر تسجيل الدخول.");
      setSession({ access_token: result.access_token }); setSchool(result.school);
      setMsg(`تم تسجيل الدخول. المدرسة: ${result.school.name}`);
    } catch (error) { setSession(null); setSchool(null); setMsg(error?.message || "تعذر تسجيل الدخول."); }
    finally { setLoggingIn(false); }
  }

  function logout() { setSession(null); setSchool(null); setRows([]); setFileName(""); setMsg(""); }

  function handleFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setFileName(file.name); setMsg("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]]; const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
        setRows(json); if (!json.length) setMsg("الملف لا يحتوي على سجلات.");
      } catch { setRows([]); setMsg("تعذر قراءة ملف Excel."); }
    };
    reader.readAsArrayBuffer(file);
  }

  async function upload() {
    if (!session?.access_token || !school) return setMsg("سجّل الدخول أولًا.");
    if (!mapped.length) return setMsg("اختر ملف Excel يحتوي على بيانات الطلبات.");
    if (mapped.some((r) => !r.request_number || !r.status)) return setMsg("تأكد أن كل سجل يحتوي على رقم الطلب والحالة.");
    if (mapped.some((r) => r.status_date && !/^\d{4}-\d{2}-\d{2}$/.test(r.status_date))) return setMsg("يوجد تاريخ حالة غير صالح. استخدم تاريخًا بصيغة YYYY-MM-DD.");
    if (mapped.length > 5000) return setMsg("الحد الأقصى للرفع الواحد 5000 سجل.");
    setBusy(true); setMsg("");
    try {
      const response = await fetch("/api/schools/request-status", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ reportDate, fileName, rows: mapped }),
      });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "تعذر حفظ التقرير.");
      const schoolName = school?.name || data.school || data.school_name || "المدرسة المرتبطة بالحساب";
      setMsg(`تم اعتماد التقرير بنجاح. المدرسة: ${schoolName} — السجلات: ${data.count}`);
    } catch (error) { setMsg(error?.message || "تعذر حفظ التقرير."); }
    finally { setBusy(false); }
  }

  if (!session || !school) return (
    <main className="shell" dir="rtl"><section className="card" style={{ maxWidth: 520 }}>
      <div className="section-label">بوابة المدارس الآمنة</div>
      <div className="page-heading"><div><h1>تسجيل دخول المدرسة</h1><p>الوصول الآمن لتقارير حالة الطلبات ورفع ملفات Excel.</p></div><div className="heading-mark">AI</div></div>
      <form onSubmit={login} style={{ display: "grid", gap: 12, marginTop: 22 }}>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني" required />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور" required />
        <button disabled={loggingIn}>{loggingIn ? "جارٍ التحقق..." : "دخول آمن"}</button>
      </form>
      {msg && <div className="notice" style={{ marginTop: 16 }}>{msg}</div>}
      <div style={{ marginTop: 18, fontSize: 13, lineHeight: 1.8, color: "var(--muted)" }}>تُمنح صلاحية المدرسة من قبل المشرف.</div>
    </section></main>
  );

  return (
    <main className="shell" dir="rtl"><section className="card" style={{ maxWidth: 1120 }}>
      <div className="page-heading"><div><div className="section-label">بوابة المدارس</div><h1>رفع تقرير حالة الطلبات</h1><p>المدرسة: <strong>{school.name}</strong></p></div><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div className="heading-mark">Excel</div><button className="secondary" type="button" onClick={logout}>خروج</button></div></div>
      <div className="grid" style={{ marginTop: 20 }}><label style={{ display: "grid", gap: 7 }}><span style={{ fontSize: 13, color: "var(--muted)" }}>تاريخ التقرير</span><input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} /></label><label className="upload wide" style={{ padding: 18, textAlign: "center" }}>اختر ملف Excel<input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: "none" }} /></label></div>
      {fileName && <div className="notice" style={{ marginTop: 14 }}>الملف: <strong>{fileName}</strong> — السجلات: {mapped.length}</div>}
      {mapped.length > 0 && <div className="tableWrap" style={{ marginTop: 18 }}><table><thead><tr><th>رقم الطلب</th><th>اسم المستفيد</th><th>الخدمة</th><th>الحالة</th><th>تاريخ الحالة</th><th>ملاحظات</th></tr></thead><tbody>{mapped.slice(0,100).map((r) => <tr key={r.id}><td>{r.request_number}</td><td>{r.applicant_name}</td><td>{r.service}</td><td>{r.status}</td><td>{r.status_date}</td><td>{r.notes}</td></tr>)}</tbody></table>{mapped.length > 100 && <p style={{ padding: 12, color: "var(--muted)" }}>للمعاينة تم عرض أول 100 سجل.</p>}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 18 }}><button onClick={upload} disabled={busy || !mapped.length}>{busy ? "جارٍ الاعتماد..." : "اعتماد ورفع التقرير"}</button><button className="secondary" type="button" onClick={() => { setRows([]); setFileName(""); setMsg(""); }}>مسح الملف</button></div>
      {msg && <div className="notice" style={{ marginTop: 16 }}>{msg}</div>}
      <div style={{ marginTop: 24, padding: 16, borderRadius: 16, background: "#f6faf8", lineHeight: 1.9 }}><strong>تنسيق Excel</strong><div style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>رقم الطلب · اسم المستفيد · الخدمة · الحالة · تاريخ الحالة · ملاحظات</div></div>
    </section></main>
  );
}
