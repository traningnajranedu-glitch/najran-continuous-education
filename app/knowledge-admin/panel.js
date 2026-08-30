"use client";

import { useEffect, useMemo, useState } from "react";
import BrandHeader from "../components/BrandHeader";

const EMPTY = { title: "", category: "عام", service: "", content: "", keywords: "", source_url: "", document_url: "", status: "draft", verified_at: "" };
const CATEGORIES = ["عام", "الطلاب", "المعلمين", "المدارس", "الجهات المختصة", "التواصل", "مصادر رسمية", "تعاميم", "أدلة وإجراءات", "أسئلة شائعة"];
const SERVICES = ["عام", "خدمات الطلاب والطالبات", "خدمات المعلمين والمعلمات", "الخدمات التعليمية والمدارس", "الاستفسارات والتوجيه"];

export default function KnowledgeAdminPanel(){
 const [password,setPassword]=useState("");
 const [authenticated,setAuthenticated]=useState(false);
 const [rows,setRows]=useState([]);
 const [form,setForm]=useState(EMPTY);
 const [editingId,setEditingId]=useState(null);
 const [q,setQ]=useState("");
 const [statusFilter,setStatusFilter]=useState("");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 const [error,setError]=useState("");

 async function load(){
  setBusy(true); setError("");
  try{
   const params=new URLSearchParams(); if(q)params.set("q",q); if(statusFilter)params.set("status",statusFilter);
   const res=await fetch(`/api/knowledge?${params.toString()}`,{cache:"no-store"});
   const data=await res.json(); if(!res.ok)throw new Error(data.error||"تعذر قراءة البيانات");
   setRows(data.rows||[]);
  }catch(e){setError(e.message)} finally{setBusy(false)}
 }
 useEffect(()=>{if(authenticated)load()},[authenticated,statusFilter]);

 async function save(e){
  e.preventDefault(); setBusy(true); setError(""); setNotice("");
  try{
   const payload={...form,keywords:form.keywords.split(",").map(s=>s.trim()).filter(Boolean)};
   const res=await fetch("/api/knowledge",{method:editingId?"PATCH":"POST",headers:{"Content-Type":"application/json","x-admin-password":password},body:JSON.stringify(editingId?{...payload,id:editingId}:payload)});
   const data=await res.json(); if(!res.ok)throw new Error(data.error||"تعذر الحفظ");
   setNotice(editingId?"تم تحديث المادة بنجاح":"تمت إضافة المادة بنجاح"); setForm(EMPTY); setEditingId(null); await load();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function remove(id){
  if(!confirm("هل تريد حذف هذه المادة؟"))return;
  setBusy(true); setError("");
  try{const res=await fetch(`/api/knowledge?id=${encodeURIComponent(id)}`,{method:"DELETE",headers:{"x-admin-password":password}});const data=await res.json();if(!res.ok)throw new Error(data.error||"تعذر الحذف");setNotice("تم حذف المادة");await load()}catch(e){setError(e.message)}finally{setBusy(false)}
 }
 function edit(r){setEditingId(r.id);setForm({title:r.title||"",category:r.category||"عام",service:r.service||"",content:r.content||"",keywords:Array.isArray(r.keywords)?r.keywords.join(", "):"",source_url:r.source_url||"",document_url:r.document_url||"",status:r.status||"draft",verified_at:r.verified_at||""});window.scrollTo({top:0,behavior:"smooth"})}
 function logout(){setAuthenticated(false);setPassword("");setRows([]);setForm(EMPTY);setEditingId(null)}
 const stats=useMemo(()=>({total:rows.length,active:rows.filter(r=>r.status==="active").length,draft:rows.filter(r=>r.status==="draft").length,inactive:rows.filter(r=>r.status==="inactive").length}),[rows]);

 async function login(e){
  e.preventDefault(); setBusy(true); setError("");
  try{const res=await fetch("/api/knowledge",{headers:{"x-admin-password":password},cache:"no-store"});const data=await res.json();if(!res.ok)throw new Error(data.error||"كلمة المرور غير صحيحة أو لم يتم إعداد الخادم");setRows(data.rows||[]);setAuthenticated(true)}catch(e){setError(e.message)}finally{setBusy(false)}
 }

 if(!authenticated)return <main className="shell admin-shell" dir="rtl"><section className="card admin knowledge-login"><BrandHeader compact/><div className="section-label">إدارة المعرفة</div><h1>لوحة التحكم المعرفية</h1><p>دخول المشرف لإدارة محتوى المساعد الذكي التعليمي.</p><form onSubmit={login}><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="كلمة مرور المشرف" required/><button disabled={busy}>{busy?"جاري التحقق...":"دخول"}</button></form>{error&&<div className="error">{error}</div>}</section></main>;

 return <main className="shell admin-shell" dir="rtl"><section className="card admin knowledge-admin">
  <BrandHeader compact/>
  <div className="top"><div><div className="section-label">قاعدة المعرفة</div><h1>لوحة التحكم المعرفية</h1><p>إدارة المحتوى الذي يعتمد عليه المساعد الذكي التعليمي.</p></div><button className="secondary" type="button" onClick={logout}>خروج</button></div>
  <div className="knowledge-stats"><div><b>{stats.total}</b><span>إجمالي المواد</span></div><div><b>{stats.active}</b><span>نشطة</span></div><div><b>{stats.draft}</b><span>مسودات</span></div><div><b>{stats.inactive}</b><span>غير نشطة</span></div></div>
  <form onSubmit={save} className="grid knowledge-form">
   <input placeholder="عنوان المادة" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/>
   <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{CATEGORIES.map(x=><option key={x}>{x}</option>)}</select>
   <select value={form.service} onChange={e=>setForm({...form,service:e.target.value})}><option value="">اختر الخدمة</option>{SERVICES.map(x=><option key={x}>{x}</option>)}</select>
   <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">مسودة</option><option value="active">نشطة</option><option value="inactive">غير نشطة</option></select>
   <input className="wide" placeholder="الكلمات المفتاحية مفصولة بفواصل" value={form.keywords} onChange={e=>setForm({...form,keywords:e.target.value})}/>
   <textarea className="wide" rows="9" placeholder="المحتوى المعرفي الموثق" value={form.content} onChange={e=>setForm({...form,content:e.target.value})} required/>
   <input placeholder="رابط المصدر الرسمي" value={form.source_url} onChange={e=>setForm({...form,source_url:e.target.value})}/>
   <input placeholder="رابط المستند / PDF" value={form.document_url} onChange={e=>setForm({...form,document_url:e.target.value})}/>
   <input type="date" value={form.verified_at} onChange={e=>setForm({...form,verified_at:e.target.value})}/>
   <div className="tools"><button type="submit" disabled={busy}>{busy?"جارٍ الحفظ...":editingId?"تحديث المادة":"إضافة المادة"}</button>{editingId&&<button type="button" className="secondary" onClick={()=>{setEditingId(null);setForm(EMPTY)}}>إلغاء التعديل</button>}</div>
  </form>
  {notice&&<div className="notice">{notice}</div>}{error&&<div className="error">{error}</div>}
  <div className="tools"><input placeholder="بحث في العنوان أو المحتوى أو الخدمة" value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")load()}}/><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="">كل الحالات</option><option value="active">نشطة</option><option value="draft">مسودات</option><option value="inactive">غير نشطة</option></select><button type="button" onClick={load} disabled={busy}>بحث</button></div>
  <div className="tableWrap"><table><thead><tr><th>العنوان</th><th>التصنيف</th><th>الخدمة</th><th>الحالة</th><th>آخر تحقق</th><th>إجراء</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.title}</td><td>{r.category}</td><td>{r.service||"—"}</td><td>{r.status}</td><td>{r.verified_at||"—"}</td><td><button className="mini" onClick={()=>edit(r)}>تعديل</button><button className="mini danger" onClick={()=>remove(r.id)}>حذف</button></td></tr>)}</tbody></table></div>
 </section></main>;
}
