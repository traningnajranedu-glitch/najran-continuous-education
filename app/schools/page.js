"use client";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { classifyReport } from "@/lib/report-classifier";

const TYPES = [
  { key: "students", title: "أداء الطلاب", icon: "🎓", hint: "التحصيل والحضور والطلاب الذين يحتاجون متابعة" },
  { key: "teachers", title: "أداء المعلمين", icon: "👩‍🏫", hint: "الانتظام والأداء المهني والاحتياج التدريبي والترشيح" },
  { key: "environment", title: "البيئة المدرسية", icon: "🏫", hint: "السلامة والنظافة والصيانة والتجهيزات" },
  { key: "activities", title: "الأنشطة والإنجازات", icon: "🏆", hint: "البرامج والمبادرات والفعاليات والإنجازات" },
  { key: "requests", title: "متابعة الطلبات والخدمات", icon: "📋", hint: "أرقام الطلبات وحالات الخدمات والمستفيدين" },
];

function normalize(v) { return String(v ?? "").trim(); }
function normalizeDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
  const text = normalize(value); if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text); if (!Number.isNaN(parsed.getTime())) return `${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,"0")}-${String(parsed.getDate()).padStart(2,"0")}`;
  return text;
}

export default function SchoolsPortal() {
  const [session, setSession] = useState(null), [school, setSchool] = useState(null);
  const [email, setEmail] = useState(""), [password, setPassword] = useState("");
  const [reportType, setReportType] = useState("students"), [reportDate, setReportDate] = useState(new Date().toISOString().slice(0,10));
  const [title, setTitle] = useState(""), [summary, setSummary] = useState("");
  const [fileName, setFileName] = useState(""), [rows, setRows] = useState([]), [reports, setReports] = useState([]);
  const [validation, setValidation] = useState(null), [confirmMismatch, setConfirmMismatch] = useState(false);
  const [search, setSearch] = useState(""), [msg, setMsg] = useState(""), [busy, setBusy] = useState(false), [loggingIn, setLoggingIn] = useState(false);
  const selectedType = useMemo(() => TYPES.find((x) => x.key === reportType), [reportType]);
  const visibleReports = useMemo(() => { const q=search.trim().toLowerCase(); return q?reports.filter(r=>[r.title,r.summary,r.source_file_name].some(v=>normalize(v).toLowerCase().includes(q))):reports; }, [reports,search]);

  useEffect(() => { try { const token=localStorage.getItem("najran_school_access_token"); const info=localStorage.getItem("najran_school_info"); if(token&&info){setSession({access_token:token});setSchool(JSON.parse(info));} } catch {} }, []);
  useEffect(() => { if(session?.access_token) loadReports(); }, [session]);

  async function login(e){ e.preventDefault(); setLoggingIn(true); setMsg(""); try { const res=await fetch("/api/schools/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email.trim(),password})}); const data=await res.json(); if(!res.ok)throw new Error(data.error||"تعذر تسجيل الدخول."); setSession({access_token:data.access_token});setSchool(data.school);localStorage.setItem("najran_school_access_token",data.access_token);localStorage.setItem("najran_school_info",JSON.stringify(data.school));setMsg("تم تسجيل الدخول بنجاح."); } catch(e){setSession(null);setSchool(null);setMsg(e?.message||"تعذر تسجيل الدخول.");} finally{setLoggingIn(false);} }
  function logout(){setSession(null);setSchool(null);setReports([]);localStorage.removeItem("najran_school_access_token");localStorage.removeItem("najran_school_info");}

  function handleFile(e){
    const file=e.target.files?.[0]; if(!file)return;
    setFileName(file.name); setMsg(""); setValidation(null); setConfirmMismatch(false);
    const reader=new FileReader();
    reader.onload=(ev)=>{try{
      const wb=XLSX.read(ev.target.result,{type:"array",cellDates:true});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const data=XLSX.utils.sheet_to_json(ws,{defval:""});
      const clean=data.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v instanceof Date?normalizeDate(v):v])));
      setRows(clean);
      if(!clean.length){setMsg("الملف لا يحتوي على سجلات.");return;}
      setValidation(classifyReport({title,summary,fileName:file.name,reportType,rows:clean}));
    }catch{setRows([]);setValidation(null);setMsg("تعذر قراءة ملف Excel.");}};
    reader.readAsArrayBuffer(file);
  }

  function revalidate(next={}){
    const result=classifyReport({title,summary,fileName,reportType,rows,...next});
    setValidation(result); return result;
  }

  async function loadReports(){ if(!session?.access_token)return; try{const res=await fetch("/api/schools/periodic-reports",{headers:{Authorization:`Bearer ${session.access_token}`}});const data=await res.json();if(!res.ok)throw new Error(data.error||"تعذر قراءة التقارير.");setReports(data.reports||[]);if(data.school)setSchool(data.school);}catch(e){setMsg(e?.message||"تعذر قراءة التقارير.");} }

  async function submitReport(){
    if(!session?.access_token||!school)return setMsg("سجّل الدخول أولًا.");
    if(!rows.length)return setMsg("اختر ملف Excel يحتوي على بيانات التقرير.");
    if(rows.length>5000)return setMsg("الحد الأقصى 5000 سجل لكل تقرير.");
    const localValidation=revalidate();
    if(localValidation.mismatch && !confirmMismatch){ setMsg("راجع نتيجة التحقق؛ تم اكتشاف عدم توافق ويجب تأكيد التصنيف المقترح قبل الاعتماد."); return; }
    setBusy(true);setMsg("");
    try{
      const res=await fetch("/api/schools/periodic-reports",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({reportType,reportDate,title,summary,fileName,reportData:rows,confirm:confirmMismatch})});
      const data=await res.json();
      if(!res.ok){
        if(data.validation){setValidation(data.validation);setMsg(data.error||"تم إيقاف اعتماد التقرير للمراجعة.");}
        else throw new Error(data.error||"تعذر اعتماد التقرير.");
        return;
      }
      setValidation(data.validation||localValidation);setMsg(`تم اعتماد التقرير وتصنيفه: ${data.validation?.detectedLabel||selectedType.title} — ${reportDate}`);setRows([]);setFileName("");setTitle("");setSummary("");setConfirmMismatch(false);await loadReports();
    }catch(e){setMsg(e?.message||"تعذر اعتماد التقرير.");}finally{setBusy(false);}
  }

  if(!session||!school)return <main className="shell" dir="rtl"><section className="card" style={{maxWidth:520}}><div className="section-label">بوابة تحديث البيانات المدرسية</div><div className="page-heading"><div><h1>دخول المدرسة</h1><p>رفع تقارير دورية عن الطلاب والمعلمين والبيئة المدرسية والأنشطة والطلبات.</p></div><div className="heading-mark">AI</div></div><form onSubmit={login} style={{display:"grid",gap:12,marginTop:22}}><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="البريد الإلكتروني" required/><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="كلمة المرور" required/><button disabled={loggingIn}>{loggingIn?"جارٍ التحقق...":"دخول آمن"}</button></form>{msg&&<div className="notice" style={{marginTop:16}}>{msg}</div>}</section></main>;

  return <main className="shell" dir="rtl"><section className="card" style={{maxWidth:1220}}><div className="page-heading"><div><div className="section-label">بوابة تحديث البيانات المدرسية</div><h1>{school.name}</h1><p>{school.code} · رفع التقارير والتحقق الذكي قبل الاعتماد</p></div><div style={{display:"flex",gap:10}}><a href="/schools/reports" className="secondary" style={{textDecoration:"none",padding:"10px 14px",borderRadius:12}}>حالات الطلبات</a><button className="secondary" onClick={logout}>خروج</button></div></div>
    <div style={{marginTop:24}}><h2>اختر مجال التقرير</h2><div className="service-grid">{TYPES.map(t=><button key={t.key} type="button" className="service-card" onClick={()=>{setReportType(t.key);setValidation(rows.length?classifyReport({title,summary,fileName,reportType:t.key,rows}):null);setConfirmMismatch(false);}} style={{outline:reportType===t.key?"2px solid currentColor":"none"}}><span className="service-icon">{t.icon}</span><span className="service-title">{t.title}</span><span className="service-arrow">←</span><small style={{display:"block",marginTop:7,color:"var(--muted)",fontWeight:400}}>{t.hint}</small></button>)}</div></div>
    <div className="grid" style={{marginTop:22}}><label style={{display:"grid",gap:7}}><span style={{fontSize:13,color:"var(--muted)"}}>تاريخ التقرير</span><input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)}/></label><label style={{display:"grid",gap:7}}><span style={{fontSize:13,color:"var(--muted)"}}>عنوان التقرير</span><input value={title} onChange={e=>{setTitle(e.target.value);if(rows.length)setValidation(classifyReport({title:e.target.value,summary,fileName,reportType,rows}));}} placeholder={`التقرير الدوري — ${selectedType.title}`}/></label></div>
    <label style={{display:"grid",gap:7,marginTop:14}}><span style={{fontSize:13,color:"var(--muted)"}}>ملخص سريع للنتائج والملاحظات</span><textarea value={summary} onChange={e=>{setSummary(e.target.value);if(rows.length)setValidation(classifyReport({title,summary:e.target.value,fileName,reportType,rows}));}} rows={3} placeholder="أبرز النتائج والملاحظات والاحتياجات."/></label>
    <label className="upload wide" style={{display:"block",padding:22,textAlign:"center",marginTop:16}}>اختر ملف Excel<input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{display:"none"}}/></label>
    {fileName&&<div className="notice" style={{marginTop:14}}>الملف: <strong>{fileName}</strong> — السجلات: {rows.length}</div>}

    {validation&&<div className="notice" style={{marginTop:16,borderRight:`5px solid ${validation.mismatch||validation.issues.length?"#b7791f":"#2f855a"}`}}>
      <strong>التحقق الذكي</strong>
      <div style={{marginTop:8}}>التصنيف المختار: <strong>{validation.requestedLabel}</strong></div>
      <div>التصنيف المكتشف من الأعمدة والبيانات: <strong>{validation.detectedLabel}</strong> — ثقة {Math.round(validation.confidence*100)}%</div>
      <div>عدد السجلات: <strong>{validation.rowCount}</strong> · المكرر: <strong>{validation.duplicateCount}</strong></div>
      {validation.mismatch&&<div style={{marginTop:8}}><strong>⚠️ عدم توافق:</strong> {validation.recommendation}</div>}
      {!validation.mismatch&&<div style={{marginTop:8}}>✅ {validation.recommendation}</div>}
      {validation.issues.length>0&&<div style={{marginTop:8}}><strong>ملاحظات جودة البيانات:</strong><ul>{validation.issues.map((x,i)=><li key={i}>{x}</li>)}</ul></div>}
      {validation.metrics?.statuses&&<div style={{marginTop:8}}>المؤشرات: {Object.entries(validation.metrics.statuses).map(([k,v])=><span key={k} style={{marginInlineStart:12}}>{k}: <strong>{v}</strong></span>)}</div>}
      {validation.metrics?.nominationStatuses&&<div style={{marginTop:8}}>حالات الترشيح: {Object.entries(validation.metrics.nominationStatuses).map(([k,v])=><span key={k} style={{marginInlineStart:12}}>{k}: <strong>{v}</strong></span>)}</div>}
      {validation.mismatch&&<label style={{display:"flex",gap:8,alignItems:"center",marginTop:12}}><input type="checkbox" checked={confirmMismatch} onChange={e=>setConfirmMismatch(e.target.checked)}/> أؤكد اعتماد التقرير بالتصنيف المكتشف «{validation.detectedLabel}».</label>}
    </div>}

    {rows.length>0&&<div className="tableWrap" style={{marginTop:18}}><table><thead><tr>{Object.keys(rows[0]).slice(0,8).map(k=><th key={k}>{k}</th>)}</tr></thead><tbody>{rows.slice(0,10).map((r,i)=><tr key={i}>{Object.values(r).slice(0,8).map((v,j)=><td key={j}>{normalize(v)||"—"}</td>)}</tr>)}</tbody></table><p style={{padding:12,color:"var(--muted)"}}>معاينة أول 10 سجلات.</p></div>}
    <div style={{display:"flex",gap:10,marginTop:18}}><button onClick={submitReport} disabled={busy||!rows.length}>{busy?"جارٍ التحقق والاعتماد...":validation?.mismatch&&!confirmMismatch?"مراجعة التصنيف قبل الاعتماد":"اعتماد التقرير"}</button><button className="secondary" onClick={()=>{setRows([]);setFileName("");setValidation(null);setConfirmMismatch(false);setMsg("")}}>مسح الملف</button></div>{msg&&<div className="notice" style={{marginTop:16}}>{msg}</div>}
    <div style={{marginTop:34}}><div className="page-heading"><div><h2>آخر التقارير المعتمدة</h2><p>كل تقرير محفوظ يحمل نتيجة التصنيف ومؤشرات التحقق ليستفيد منها المساعد الذكي.</p></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث في التقارير" style={{maxWidth:320}}/></div><div className="tableWrap" style={{marginTop:14}}><table><thead><tr><th>المجال</th><th>التصنيف الذكي</th><th>التاريخ</th><th>العنوان</th><th>الملف</th></tr></thead><tbody>{visibleReports.length===0?<tr><td colSpan={5} style={{textAlign:"center",padding:28}}>لا توجد تقارير معتمدة حتى الآن.</td></tr>:visibleReports.map(r=><tr key={r.id}><td>{TYPES.find(t=>t.key===r.report_type)?.title||r.report_type}</td><td>{r.detected_report_type||"—"}{r.classification_confidence?` (${Math.round(Number(r.classification_confidence)*100)}%)`:""}</td><td>{r.report_date}</td><td>{r.title||"—"}</td><td>{r.source_file_name||"—"}</td></tr>)}</tbody></table></div></div>
  </section></main>;
}
