"use client";

import { useMemo, useState } from "react";

const EMPTY={id:"",title:"",category:"عام",keywords:"",content:"",sourceUrl:"",verifiedAt:"",active:true};

export default function KnowledgeAdminPanel(){
 const [password,setPassword]=useState("");
 const [logged,setLogged]=useState(false);
 const [items,setItems]=useState([]);
 const [form,setForm]=useState(EMPTY);
 const [editing,setEditing]=useState(false);
 const [q,setQ]=useState("");
 const [msg,setMsg]=useState("");
 const [busy,setBusy]=useState(false);

 async function login(e){
  e.preventDefault(); setBusy(true); setMsg("");
  try{const r=await fetch("/api/knowledge-admin",{headers:{"x-admin-password":password}}); const d=await r.json(); if(!r.ok) throw new Error(d.error||"تعذر الدخول"); setItems(d.items||[]); setLogged(true);}
  catch(e){setMsg(e.message||"تعذر الدخول");} finally{setBusy(false)}
 }
 async function save(e){
  e.preventDefault(); setBusy(true); setMsg("");
  const payload={...form,keywords:String(form.keywords||"").split(",").map(s=>s.trim()).filter(Boolean)};
  try{const r=await fetch("/api/knowledge-admin",{method:editing?"PUT":"POST",headers:{"Content-Type":"application/json","x-admin-password":password},body:JSON.stringify(payload)});const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر الحفظ");setItems(d.items||[]);setForm(EMPTY);setEditing(false);setMsg("تم حفظ السجل بنجاح.");}
  catch(e){setMsg(e.message||"تعذر الحفظ");} finally{setBusy(false)}
 }
 async function remove(id){if(!confirm("تأكيد حذف السجل؟"))return;setBusy(true);try{const r=await fetch("/api/knowledge-admin?id="+encodeURIComponent(id),{method:"DELETE",headers:{"x-admin-password":password}});const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر الحذف");setItems(d.items||[]);setMsg("تم حذف السجل.");}catch(e){setMsg(e.message||"تعذر الحذف");}finally{setBusy(false)}}
 const filtered=useMemo(()=>{const x=q.trim().toLowerCase();return !x?items:items.filter(i=>[i.title,i.category,i.content,...(i.keywords||[])].join(" ").toLowerCase().includes(x));},[items,q]);
 if(!logged)return <main className="shell" dir="rtl"><section className="card" style={{maxWidth:520}}><div className="section-label">المحتوى المعرفي</div><h1>لوحة المعرفة</h1><p style={{color:"var(--muted)",lineHeight:1.8}}>لوحة مخصصة لمشرفي المساعد الذكي التعليمي.</p><form onSubmit={login} style={{display:"grid",gap:12}}><input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="كلمة مرور المشرف" required/><button disabled={busy}>دخول</button></form>{msg&&<div className="error">{msg}</div>}</section></main>;
 return <main className="shell" dir="rtl"><section className="card" style={{maxWidth:1080}}><div className="page-heading"><div><div className="section-label">قاعدة المعرفة</div><h1>إدارة محتوى المساعد التعليمي</h1><p>أضف المعلومات الموثقة، واربطها بالمصدر الرسمي، وحدثها متى ما صدرت معلومات جديدة.</p></div><div className="heading-mark">AI</div></div>
 <form onSubmit={save} className="grid"><input placeholder="المعرف الفريد" value={form.id} onChange={e=>setForm({...form,id:e.target.value})} required/><input placeholder="عنوان السجل" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required/><input placeholder="التصنيف" value={form.category} onChange={e=>setForm({...form,category:e.target.value})}/><input placeholder="كلمات مفتاحية مفصولة بفواصل" value={form.keywords} onChange={e=>setForm({...form,keywords:e.target.value})}/><textarea className="wide" rows="6" placeholder="المحتوى الموثق" value={form.content} onChange={e=>setForm({...form,content:e.target.value})} required/><input placeholder="رابط المصدر الرسمي" value={form.sourceUrl} onChange={e=>setForm({...form,sourceUrl:e.target.value})} required/><input type="date" value={form.verifiedAt||""} onChange={e=>setForm({...form,verifiedAt:e.target.value})}/><label><input type="checkbox" checked={!!form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> السجل مفعل</label><div className="wide" style={{display:"flex",gap:10}}><button disabled={busy}>{editing?"حفظ التعديل":"إضافة إلى قاعدة المعرفة"}</button>{editing&&<button type="button" className="secondary" onClick={()=>{setEditing(false);setForm(EMPTY)}}>إلغاء</button>}</div></form>
 {msg&&<div className="notice">{msg}</div>}
 <div className="tools"><input placeholder="بحث في قاعدة المعرفة" value={q} onChange={e=>setQ(e.target.value)}/><span style={{alignSelf:"center",color:"var(--muted)",fontSize:13}}>السجلات: {filtered.length}</span></div>
 <div style={{display:"grid",gap:12,marginTop:18}}>{filtered.map(item=><article key={item.id} style={{border:"1px solid var(--line)",borderRadius:18,padding:18,background:"#fff"}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}><div><strong style={{color:"var(--green-dark)",fontSize:17}}>{item.title}</strong><div style={{color:"var(--muted)",fontSize:12,marginTop:5}}>{item.category} · {item.id} · {item.active?"مفعل":"غير مفعل"}</div></div><div style={{display:"flex",gap:8}}><button className="mini" onClick={()=>{setEditing(true);setForm({...item,keywords:(item.keywords||[]).join(", ")});window.scrollTo({top:0,behavior:"smooth"})}}>تعديل</button><button className="mini danger" onClick={()=>remove(item.id)}>حذف</button></div></div><p style={{lineHeight:1.85,color:"#284840"}}>{item.content}</p><a href={item.sourceUrl} target="_blank" rel="noreferrer" style={{color:"var(--green)",fontSize:13}}>فتح المصدر الرسمي ↗</a></article>)}</div>
 </section></main>;
}
