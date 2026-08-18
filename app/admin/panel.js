 "use client";
import {useEffect,useState} from "react";
import * as XLSX from "xlsx";
import {supabase} from "../../lib/supabase";
import BrandHeader from "../components/BrandHeader";

export default function AdminPanel(){
 const [session,setSession]=useState(null),[email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [rows,setRows]=useState([]),[form,setForm]=useState({id:"",name:"",school:"",specialty:"",status:"مرشح",message:""});
 const [q,setQ]=useState(""),[msg,setMsg]=useState("");
 async function load(){const {data}=await supabase.from("candidates").select("*").order("created_at",{ascending:false});setRows(data||[])}
 useEffect(()=>{supabase.auth.getSession().then(({data})=>{setSession(data.session);if(data.session)load()}); const {data:l}=supabase.auth.onAuthStateChange((_e,s)=>{setSession(s);if(s)load()});return()=>l.subscription.unsubscribe()},[]);
 async function login(e){e.preventDefault();const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)setMsg(error.message);else setSession(data.session)}
 async function save(e){e.preventDefault();setMsg(""); if(!form.id||!form.name)return setMsg("أدخل رقم السجل المدني والاسم."); const {error}=await supabase.from("candidates").upsert({civil_id:form.id,name:form.name,school:form.school,specialty:form.specialty,status:form.status,message:form.message}); if(error)setMsg(error.message);else{setMsg("تم الحفظ بنجاح");setForm({id:"",name:"",school:"",specialty:"",status:"مرشح",message:""});load()}}
 async function remove(id){if(!confirm("حذف هذا المرشح؟"))return;await supabase.from("candidates").delete().eq("id",id);load()}
 function edit(r){setForm({id:r.civil_id,name:r.name,school:r.school||"",specialty:r.specialty||"",status:r.status||"مرشح",message:r.message||""});window.scrollTo({top:0,behavior:"smooth"})}
 async function importExcel(e){
  const file=e.target.files[0]; if(!file)return; const buf=await file.arrayBuffer(); const wb=XLSX.read(buf); const sh=wb.Sheets[wb.SheetNames[0]]; const a=XLSX.utils.sheet_to_json(sh,{header:1});
  const out=[]; for(const r of a){ if(r[2] && r[1] && r[0]!== "م"){out.push({civil_id:String(r[2]).replace(/\\.0$/,""),name:String(r[1]).trim(),school:r[3]?String(r[3]).trim():"",specialty:"",status:"مرشح",message:""})}}
  if(out.length){const {error}=await supabase.from("candidates").upsert(out,{onConflict:"civil_id"});setMsg(error?error.message:`تم استيراد ${out.length} سجل.`);load()}
 }
 if(!session)return <main className="shell admin-shell"><section className="card admin"><BrandHeader compact /><div className="section-label">لوحة الإدارة</div><h1>تسجيل الدخول</h1><form onSubmit={login}><input type="email" placeholder="البريد الإلكتروني" value={email} onChange={e=>setEmail(e.target.value)} required/><input type="password" placeholder="كلمة المرور" value={password} onChange={e=>setPassword(e.target.value)} required/><button>دخول</button></form>{msg&&<div className="error">{msg}</div>}</section></main>;
 const filtered=rows.filter(r=>(r.name+" "+r.civil_id+" "+(r.school||"")).includes(q));
 return <main className="shell admin-shell"><section className="card admin">
  <BrandHeader compact />
  <div className="top"><div><div className="section-label">لوحة الإدارة</div><h1>إدارة الترشيحات</h1></div><button className="secondary" onClick={()=>supabase.auth.signOut()}>خروج</button></div>
  <form onSubmit={save} className="grid">
   <input placeholder="رقم السجل المدني" value={form.id} onChange={e=>setForm({...form,id:e.target.value.replace(/\D/g,"")})}/>
   <input placeholder="اسم المعلم/المعلمة" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
   <input placeholder="مدرسة الترشيح" value={form.school} onChange={e=>setForm({...form,school:e.target.value})}/>
   <input placeholder="التخصص" value={form.specialty} onChange={e=>setForm({...form,specialty:e.target.value})}/>
   <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option>مرشح</option><option>غير مرشح</option><option>تحت الإجراء</option><option>معتذر</option></select>
   <textarea className="wide" placeholder="رسالة الترشيح / الملاحظات" value={form.message} onChange={e=>setForm({...form,message:e.target.value})}/>
   <button className="wide">حفظ / تحديث</button>
  </form>
  <div className="tools"><input placeholder="بحث بالاسم أو السجل أو المدرسة" value={q} onChange={e=>setQ(e.target.value)}/><label className="upload">استيراد Excel<input type="file" accept=".xlsx,.xls" onChange={importExcel}/></label></div>
  {msg&&<div className="notice">{msg}</div>}
  <div className="tableWrap"><table><thead><tr><th>الاسم</th><th>المدرسة</th><th>الحالة</th><th>إجراء</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.school}</td><td>{r.status}</td><td><button className="mini" onClick={()=>edit(r)}>تعديل</button> <button className="mini danger" onClick={()=>remove(r.id)}>حذف</button></td></tr>)}</tbody></table></div>
 </section></main>
}