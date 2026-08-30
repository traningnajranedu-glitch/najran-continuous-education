"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";

const REQUIRED = ["رقم الطلب", "الحالة"];

function normalize(v) {
  return String(v ?? "").trim();
}

export default function SchoolsPortal() {
  const [schoolName, setSchoolName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const mapped = useMemo(() => rows.map((r, i) => ({
    id: i + 1,
    request_number: normalize(r["رقم الطلب"] || r["request_number"] || r["رقم الطلبة"]),
    applicant_name: normalize(r["اسم المستفيد"] || r["اسم الطالب"] || r["applicant_name"]),
    service: normalize(r["الخدمة"] || r["service"]),
    status: normalize(r["الحالة"] || r["status"]),
    status_date: normalize(r["تاريخ الحالة"] || r["status_date"]),
    notes: normalize(r["ملاحظات"] || r["notes"]),
  })), [rows]);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name); setMsg("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
        setRows(json);
        if (!json.length) setMsg("الملف لا يحتوي على سجلات.");
      } catch {
        setRows([]); setMsg("تعذر قراءة ملف Excel.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function upload() {
    setMsg("");
    if (!schoolName.trim() || !schoolCode.trim()) return setMsg("أدخل اسم المدرسة ورمز المدرسة.");
    if (!mapped.length) return setMsg("اختر ملف Excel يحتوي على بيانات الطلبات.");
    const missing = REQUIRED.filter((key) => !Object.keys(rows[0] || {}).includes(key) && !mapped.some((r) => r[key === "رقم الطلب" ? "request_number" : "status"]));
    if (missing.length || mapped.some(r => !r.request_number || !r.status)) return setMsg("تأكد أن كل سجل يحتوي على رقم الطلب والحالة.");

    setBusy(true);
    try {
      const res = await fetch("/api/schools/request-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolName, schoolCode, fileName, rows: mapped }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذر حفظ التقرير");
      setMsg(`تم حفظ التقرير بنجاح. عدد السجلات: ${data.count}`);
    } catch (e) {
      setMsg(e.message || "تعذر حفظ التقرير");
    } finally { setBusy(false); }
  }

  return (
    <main className="shell" dir="rtl">
      <section className="card" style={{maxWidth:1100}}>
        <div className="section-label">بوابة المدارس</div>
        <div className="page-heading">
          <div>
            <h1>رفع تقرير حالة الطلبات</h1>
            <p>ارفع ملف Excel اليومي، راجع البيانات، ثم احفظ التقرير ليصبح متاحًا للمستخدمين المصرح لهم.</p>
          </div>
          <div className="heading-mark">Excel</div>
        </div>

        <div className="grid" style={{marginTop:20}}>
          <input placeholder="اسم المدرسة" value={schoolName} onChange={e=>setSchoolName(e.target.value)} />
          <input placeholder="رمز المدرسة" value={schoolCode} onChange={e=>setSchoolCode(e.target.value)} />
          <label className="upload wide" style={{padding:18,textAlign:"center"}}>
            اختر ملف Excel
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{display:"none"}} />
          </label>
        </div>

        {fileName && <div className="notice" style={{marginTop:14}}>الملف المختار: <strong>{fileName}</strong> — السجلات: {mapped.length}</div>}

        {mapped.length > 0 && (
          <div className="tableWrap" style={{marginTop:18}}>
            <table>
              <thead><tr><th>رقم الطلب</th><th>اسم المستفيد</th><th>الخدمة</th><th>الحالة</th><th>تاريخ الحالة</th><th>ملاحظات</th></tr></thead>
              <tbody>{mapped.slice(0,100).map(r=><tr key={r.id}><td>{r.request_number}</td><td>{r.applicant_name}</td><td>{r.service}</td><td>{r.status}</td><td>{r.status_date}</td><td>{r.notes}</td></tr>)}</tbody>
            </table>
            {mapped.length>100 && <p style={{padding:12,color:"var(--muted)"}}>تم عرض أول 100 سجل فقط للمعاينة.</p>}
          </div>
        )}

        <div style={{display:"flex",gap:10,marginTop:18}}>
          <button onClick={upload} disabled={busy || !mapped.length}>{busy?"جارٍ الحفظ...":"اعتماد ورفع التقرير"}</button>
          <button className="secondary" type="button" onClick={()=>{setRows([]);setFileName("");setMsg("")}}>إلغاء الملف</button>
        </div>

        {msg && <div className="notice" style={{marginTop:16}}>{msg}</div>}

        <div style={{marginTop:24,padding:16,borderRadius:16,background:"#f6faf8",lineHeight:1.9}}>
          <strong>تنسيق ملف Excel المقترح</strong>
          <div style={{fontSize:13,color:"var(--muted)",marginTop:8}}>رقم الطلب · اسم المستفيد · الخدمة · الحالة · تاريخ الحالة · ملاحظات</div>
        </div>
      </section>
    </main>
  );
}
