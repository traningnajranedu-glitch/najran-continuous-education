"use client";

import { useEffect, useRef, useState } from "react";
import BrandHeader from "./components/BrandHeader";

const INTERACTIVE_SERVICES = [
 {icon:"🎓",title:"خدمات الطلاب والطالبات",prompt:"أريد الاستفسار عن خدمات الطلاب والطالبات في إدارة التعليم بمنطقة نجران."},
 {icon:"👩‍🏫",title:"خدمات المعلمين والمعلمات",prompt:"أريد الاستفسار عن خدمات المعلمين والمعلمات في إدارة التعليم بمنطقة نجران."},
 {icon:"🏫",title:"الخدمات التعليمية والمدارس",prompt:"أريد الاستفسار عن الخدمات التعليمية والمدارس التابعة لإدارة التعليم بمنطقة نجران."},
 {icon:"💬",title:"الاستفسارات والتوجيه",prompt:"أحتاج مساعدة في تحديد الجهة أو الخدمة المناسبة في إدارة التعليم بمنطقة نجران."}
];

export default function Home(){
 const [message,setMessage]=useState("");
 const [messages,setMessages]=useState([]);
 const [loading,setLoading]=useState(false);
 const [listening,setListening]=useState(false);
 const [speaking,setSpeaking]=useState(false);
 const recognitionRef=useRef(null);
 const audioRef=useRef(null);

 useEffect(()=>{
   if(typeof window === "undefined") return;
   const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
   if(!SR) return;
   const r=new SR(); r.lang="ar-SA"; r.continuous=false; r.interimResults=false;
   r.onstart=()=>setListening(true); r.onend=()=>setListening(false); r.onerror=()=>setListening(false);
   r.onresult=e=>setMessage(e.results?.[0]?.[0]?.transcript||"");
   recognitionRef.current=r;
   return()=>{try{r.stop()}catch{}};
 },[]);

 function toggleListening(){
  const r=recognitionRef.current;
  if(!r){alert("المتصفح الحالي لا يدعم الإدخال الصوتي. جرّب Google Chrome أو Microsoft Edge.");return;}
  try{listening?r.stop():r.start()}catch{}
 }

 function makeAudioUrl(base64,mime="audio/mpeg"){
  const binary=atob(base64); const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes],{type:mime}));
 }

 async function playAudio(base64,mime="audio/mpeg"){
  if(!base64) return false;
  try{
   if(audioRef.current){audioRef.current.pause(); if(audioRef.current.src?.startsWith("blob:")) URL.revokeObjectURL(audioRef.current.src)}
   const audio=new Audio(makeAudioUrl(base64,mime));
   audio.preload="auto"; audioRef.current=audio;
   audio.onplay=()=>setSpeaking(true); audio.onended=()=>setSpeaking(false); audio.onerror=()=>setSpeaking(false);
   await audio.play(); return true;
  }catch{return false}
 }

 async function sendText(text){
  const clean=text.trim(); if(!clean||loading)return;
  setMessages(p=>[...p,{role:"user",text:clean}]); setMessage(""); setLoading(true);
  try{
   const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:clean})});
   const data=await res.json(); if(!res.ok) throw new Error(data?.error||"request failed");
   const reply=String(data.reply||"").trim()||"عذرًا، لم يصل رد من المساعد حاليًا.";
   setMessages(p=>[...p,{role:"assistant",text:reply,audio:data.audio||null,audioType:data.audioType||"audio/mpeg"}]);
   if(data.audio) await playAudio(data.audio,data.audioType||"audio/mpeg");
  }catch{setMessages(p=>[...p,{role:"assistant",text:"عذرًا، تعذر الاتصال بالمساعد التعليمي حاليًا.",audio:null}]);}
  finally{setLoading(false)}
 }

 function sendMessage(e){e?.preventDefault();sendText(message)}

 return <main className="shell ai-shell" dir="rtl"><section className="hero ai-hero modern-ai"><BrandHeader/><div className="tech-line"/><div className="ai-icon" aria-hidden="true">🤖</div><h1>المساعد الذكي التعليمي</h1><p className="hero-description">إدارة التعليم بمنطقة نجران</p>
 <section className="interactive-services" aria-label="الخدمات التفاعلية"><div className="interactive-heading"><span className="service-kicker">خدمات تفاعلية</span><h2>اختر الخدمة وابدأ الاستفسار</h2><p>خيارات سريعة تساعدك على الوصول للمعلومة وطرح سؤالك مباشرة.</p></div><div className="service-grid">{INTERACTIVE_SERVICES.map(s=><button type="button" className="service-card" key={s.title} onClick={()=>sendText(s.prompt)} disabled={loading}><span className="service-icon">{s.icon}</span><span><strong>{s.title}</strong><small>اضغط للاستفسار</small></span><span className="service-arrow">←</span></button>)}</div></section>
 <div className="chat-box modern-chat"><div className="chat-header"><span className="online-dot"/> المساعد متاح الآن</div><div className="chat-messages" aria-live="polite">{messages.length===0&&<div className="chat-welcome"><strong>مرحبًا بك 👋</strong><span>اختر خدمة من الأعلى أو اكتب سؤالك أو تحدث بالصوت.</span></div>}{messages.map((m,i)=><div key={i} className={`chat-message ${m.role}`}><span>{m.text}</span>{m.role==="assistant"&&m.audio&&<div className="audio-actions"><button type="button" className="speak-replay" onClick={()=>playAudio(m.audio,m.audioType||"audio/mpeg")} aria-label="تشغيل الرد الصوتي">🔊 تشغيل</button><audio controls preload="none" src={`data:${m.audioType||"audio/mpeg"};base64,${m.audio}`} /></div>}</div>)}{loading&&<div className="chat-message assistant"><span>جاري إعداد الرد...</span></div>}</div><form className="ai-chat-input" onSubmit={sendMessage}><input value={message} onChange={e=>setMessage(e.target.value)} placeholder="اكتب سؤالك هنا..." aria-label="اكتب سؤالك هنا" disabled={loading}/><button type="button" onClick={toggleListening} className={listening?"voice-active":""} aria-label={listening?"إيقاف التسجيل":"التحدث صوتيًا"}>{listening?"⏹️":"🎤"}</button><button type="submit" disabled={loading||!message.trim()}>{loading?"...":"إرسال"}</button></form><div className="voice-status" aria-live="polite">{listening?"🎙️ أستمع إليك الآن...":speaking?"🔊 المساعد يتحدث الآن...":""}</div></div><div className="home-footer"><span>إدارة التعليم بمنطقة نجران</span></div></section></main>
}
