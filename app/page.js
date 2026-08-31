"use client";

import { useEffect, useRef, useState } from "react";
import BrandHeader from "./components/BrandHeader";
import { NAJRAN_SERVICES } from "../data/najran-services";

const SERVICE_ITEMS = [
  ["students", "🎓", NAJRAN_SERVICES.students],
  ["teachers", "👩‍🏫", NAJRAN_SERVICES.teachers],
  ["schools", "🏫", NAJRAN_SERVICES.schools],
  ["guidance", "💬", NAJRAN_SERVICES.guidance],
];

export default function Home(){
 const [message,setMessage]=useState("");
 const [messages,setMessages]=useState([]);
 const [loading,setLoading]=useState(false);
 const [listening,setListening]=useState(false);
 const [speaking,setSpeaking]=useState(false);
 const [selectedService,setSelectedService]=useState(null);
 const recognitionRef=useRef(null);
 const audioRef=useRef(null);

 useEffect(()=>{
   if(typeof window === "undefined") return;
   const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
   if(!SR) return;
   const r=new SR();
   r.lang="ar-SA"; r.continuous=false; r.interimResults=false;
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
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes],{type:mime}));
 }

 async function playAudio(base64,mime="audio/mpeg"){
  if(!base64)return false;
  try{
   if(audioRef.current){audioRef.current.pause(); if(audioRef.current.src?.startsWith("blob:"))URL.revokeObjectURL(audioRef.current.src)}
   const audio=new Audio(makeAudioUrl(base64,mime)); audio.preload="auto"; audioRef.current=audio;
   audio.onplay=()=>setSpeaking(true);
   audio.onended=()=>{setSpeaking(false); if(audio.src?.startsWith("blob:"))URL.revokeObjectURL(audio.src)};
   audio.onerror=()=>setSpeaking(false);
   await audio.play(); return true;
  }catch{return false;}
 }

 async function sendMessageText(text){
  const value=String(text||"").trim(); if(!value||loading)return;
  setMessages(p=>[...p,{role:"user",text:value}]); setMessage(""); setLoading(true);
  try{
   const headers={"Content-Type":"application/json"};
   if(typeof window !== "undefined"){
    const token=window.localStorage.getItem("najran_school_access_token");
    if(token) headers.Authorization=`Bearer ${token}`;
   }
   const res=await fetch("/api/chat-audio",{method:"POST",headers,body:JSON.stringify({message:value})});
   const data=await res.json(); if(!res.ok)throw new Error(data?.error||"request failed");
   const reply=String(data.reply||"").trim()||"عذرًا، لم يصل رد من المساعد حاليًا.";
   setMessages(p=>[...p,{role:"assistant",text:reply,audio:data.audio||null,audioType:data.audioType||"audio/mpeg"}]);
   if(data.audio)await playAudio(data.audio,data.audioType||"audio/mpeg");
  }catch(error){
   setMessages(p=>[...p,{role:"assistant",text:error?.message||"عذرًا، تعذر الاتصال بالمساعد التعليمي حاليًا.",audio:null}]);
  }finally{setLoading(false);}
 }

 async function sendMessage(e){e?.preventDefault();await sendMessageText(message);}

 function selectService(serviceKey){setSelectedService(serviceKey);}
 function selectOption(option){
  const item=NAJRAN_SERVICES[selectedService];
  const prompt=`أريد الاستفسار عن «${option}» ضمن «${item.title}» في الإدارة العامة للتعليم بمنطقة نجران. استخدم المصادر الرسمية المتاحة المرتبطة بهذه الخدمة، واذكر لي فقط المعلومات الموثوقة. إذا لم تتوفر معلومة، صرّح بذلك بوضوح ولا تخترع شروطًا أو مواعيد أو أرقامًا أو إجراءات.`;
  sendMessageText(prompt);
 }
 function resetServicePath(){setSelectedService(null);}

 const active=selectedService?NAJRAN_SERVICES[selectedService]:null;

 return <main className="shell ai-shell" dir="rtl">
  <section className="hero ai-hero modern-ai">
   <BrandHeader/>
   <div className="tech-line"/>
   <div className="ai-icon" aria-hidden="true">🤖</div>
   <h1>المساعد الذكي التعليمي</h1>
   <p className="hero-description">إدارة التعليم بمنطقة نجران</p>

   <div className="service-flow" aria-live="polite">
    {selectedService===null ? (
      <>
       <div className="flow-title">اختر مجال الخدمة التي تحتاجها</div>
       <div className="service-grid" aria-label="مجالات الخدمات">
        {SERVICE_ITEMS.map(([key,icon,item])=><button key={key} type="button" className="service-card" onClick={()=>selectService(key)} disabled={loading}>
         <span className="service-icon">{icon}</span>
         <span className="service-title">{item.title}</span>
         <span className="service-arrow">←</span>
        </button>)}
       </div>
      </>
    ) : (
      <div className="service-options-panel">
       <div className="flow-breadcrumb"><button type="button" className="flow-back" onClick={resetServicePath} disabled={loading}>→ المجالات الرئيسية</button></div>
       <div className="flow-title"><span>{SERVICE_ITEMS.find(([key])=>key===selectedService)?.[1]}</span> {active.title}</div>
       <p className="service-description">{active.description}</p>
       <div className="option-grid">
        {active.followUp.map(option=><button key={option.label} type="button" className="option-card" onClick={()=>selectOption(option.label)} disabled={loading}>
          <span>{option.label}</span><strong>←</strong>
        </button>)}
       </div>
       <div className="official-sources">
        <div className="official-source-title">المصادر الرسمية المرتبطة</div>
        <div className="official-source-list">
         {active.officialSources.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="official-source">{source.name} ↗</a>)}
        </div>
       </div>
       <div className="flow-note">المعلومات الإجرائية تُعرض من المصادر الرسمية المتاحة، ويمكنك متابعة الاستفسار كتابيًا أو صوتيًا.</div>
      </div>
    )}
   </div>

   <div className="chat-box modern-chat">
    <div className="chat-header"><span className="online-dot"/> المساعد متاح الآن</div>
    <div className="chat-messages" aria-live="polite">
     {messages.length===0&&<div className="chat-welcome"><strong>مرحبًا بك 👋</strong><span>اختر مجالًا من الأعلى أو اكتب سؤالك مباشرة.</span></div>}
     {messages.map((m,i)=><div key={i} className={`chat-message ${m.role}`}>
      <div><div>{m.text}</div>{m.role==="assistant"&&m.audio&&<div className="audio-actions"><button type="button" className="speak-replay" onClick={()=>playAudio(m.audio,m.audioType||"audio/mpeg")}>🔊 تشغيل</button><audio controls preload="none" src={`data:${m.audioType||"audio/mpeg"};base64,${m.audio}`} /></div>}</div>
     </div>)}
     {loading&&<div className="chat-message assistant"><span>جاري إعداد الرد...</span></div>}
    </div>

    <form className="ai-chat-input" onSubmit={sendMessage}>
      <input value={message} onChange={e=>setMessage(e.target.value)} placeholder="اكتب سؤالك هنا..." aria-label="اكتب سؤالك هنا" disabled={loading}/>
      <button type="button" onClick={toggleListening} className={listening?"voice-active":""} aria-label={listening?"إيقاف التسجيل":"التحدث صوتيًا"}>{listening?"⏹️":"🎤"}</button>
      <button type="submit" disabled={loading||!message.trim()}>{loading?"...":"إرسال"}</button>
    </form>
    <div className="voice-status" aria-live="polite">{listening?"🎙️ أستمع إليك الآن...":speaking?"🔊 المساعد يتحدث الآن...":""}</div>
   </div>
   <div className="home-footer"><span>إدارة التعليم بمنطقة نجران</span></div>
  </section>
 </main>;
}
