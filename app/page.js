"use client";

import { useEffect, useRef, useState } from "react";
import BrandHeader from "./components/BrandHeader";

const WEBHOOK_URL = "https://abrahem606.app.n8n.cloud/webhook/najran-education-ai";

export default function Home(){
 const [message,setMessage]=useState("");
 const [messages,setMessages]=useState([]);
 const [loading,setLoading]=useState(false);
 const [listening,setListening]=useState(false);
 const [speaking,setSpeaking]=useState(false);
 const recognitionRef=useRef(null);

 useEffect(()=>{
   if(typeof window === "undefined") return;
   const SpeechRecognition=window.SpeechRecognition || window.webkitSpeechRecognition;
   if(!SpeechRecognition) return;
   const recognition=new SpeechRecognition();
   recognition.lang="ar-SA";
   recognition.continuous=false;
   recognition.interimResults=false;
   recognition.onstart=()=>setListening(true);
   recognition.onend=()=>setListening(false);
   recognition.onerror=()=>setListening(false);
   recognition.onresult=(event)=>{
     const transcript=event.results?.[0]?.[0]?.transcript || "";
     setMessage(transcript);
   };
   recognitionRef.current=recognition;
   return ()=>{ try{recognition.stop();}catch{} };
 },[]);

 function toggleListening(){
   const recognition=recognitionRef.current;
   if(!recognition){
     alert("المتصفح الحالي لا يدعم الإدخال الصوتي. جرّب Google Chrome أو Microsoft Edge.");
     return;
   }
   try{
     if(listening) recognition.stop();
     else recognition.start();
   }catch{}
 }

 function speak(text){
   if(typeof window === "undefined" || !window.speechSynthesis) return;
   window.speechSynthesis.cancel();
   const utterance=new SpeechSynthesisUtterance(text);
   utterance.lang="ar-SA";
   utterance.rate=0.92;
   utterance.pitch=1;
   const voices=window.speechSynthesis.getVoices();
   const saVoice=voices.find(v=>v.lang?.toLowerCase()==="ar-sa") || voices.find(v=>v.lang?.toLowerCase().startsWith("ar"));
   if(saVoice) utterance.voice=saVoice;
   utterance.onstart=()=>setSpeaking(true);
   utterance.onend=()=>setSpeaking(false);
   utterance.onerror=()=>setSpeaking(false);
   window.speechSynthesis.speak(utterance);
 }

 async function sendMessage(e){
  e?.preventDefault();
  const text=message.trim();
  if(!text || loading) return;
  setMessages(prev=>[...prev,{role:"user",text}]);
  setMessage("");
  setLoading(true);
  try{
   const res=await fetch(WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text})});
   if(!res.ok) throw new Error("تعذر الاتصال بالمساعد");
   const data=await res.json();
   const reply=data.reply || data.output || data.text || "عذرًا، لم يصل رد من المساعد حاليًا.";
   const cleanReply=String(reply).replace(/^=/,"");
   setMessages(prev=>[...prev,{role:"assistant",text:cleanReply}]);
   speak(cleanReply);
  }catch(err){
   setMessages(prev=>[...prev,{role:"assistant",text:"عذرًا، تعذر الاتصال بالمساعد التعليمي حاليًا. حاول مرة أخرى."}]);
  }finally{setLoading(false);}
 }

 function quick(text){ setMessage(text); }

 return <main className="shell ai-shell" dir="rtl">
  <section className="hero ai-hero">
   <BrandHeader />
   <div className="hero-badge"><span>خدمة ذكية</span><span className="badge-dot" /></div>
   <div className="ai-icon" aria-hidden="true">🤖</div>
   <h1>المساعد التعليمي الذكي</h1>
   <p className="hero-description">مساعدك الذكي للحصول على المعلومات والخدمات التعليمية التابعة للإدارة العامة للتعليم بمنطقة نجران</p>
   <div className="quick-actions">
    <button type="button" onClick={()=>quick("ما هي الخدمات التعليمية التي تقدمها إدارة التعليم بمنطقة نجران؟")}>الخدمات التعليمية</button>
    <button type="button" onClick={()=>quick("ما هي الأسئلة الشائعة؟")}>الأسئلة الشائعة</button>
    <button type="button" onClick={()=>quick("أحتاج التواصل مع الجهة المختصة")}>التواصل مع الجهة المختصة</button>
   </div>
   <div className="chat-box">
    <div className="chat-messages" aria-live="polite">
      {messages.length===0 && <div className="chat-welcome"><strong>مرحبًا بك 👋</strong><span>يمكنك الكتابة أو التحدث بالصوت، وسأجيبك مباشرة.</span></div>}
      {messages.map((m,i)=><div key={i} className={`chat-message ${m.role}`}><span>{m.text}</span>{m.role==="assistant" && <button type="button" className="speak-replay" onClick={()=>speak(m.text)} aria-label="إعادة تشغيل الرد الصوتي">🔊</button>}</div>)}
      {loading && <div className="chat-message assistant"><span>جاري إعداد الرد...</span></div>}
    </div>
    <form className="ai-chat-input" onSubmit={sendMessage}>
      <input value={message} onChange={e=>setMessage(e.target.value)} placeholder="اكتب سؤالك هنا أو اضغط 🎤 للتحدث..." aria-label="اكتب سؤالك هنا" disabled={loading}/>
      <button type="button" onClick={toggleListening} className={listening?"voice-active":""} aria-label={listening?"إيقاف التسجيل":"التحدث صوتيًا"}>{listening?"⏹️":"🎤"}</button>
      <button type="submit" disabled={loading || !message.trim()}>{loading?"...":"إرسال"}</button>
    </form>
    <div className="voice-status" aria-live="polite">{listening?"🎙️ أستمع إليك الآن...":speaking?"🔊 المساعد يتحدث الآن...":""}</div>
   </div>
   <div className="home-footer"><span>الإدارة العامة للتعليم بمنطقة نجران</span></div>
  </section>
 </main>
}
