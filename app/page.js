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
   recognition.onresult=(event)=>setMessage(event.results?.[0]?.[0]?.transcript || "");
   recognitionRef.current=recognition;
   return ()=>{ try{recognition.stop();}catch{} };
 },[]);

 function toggleListening(){
   const recognition=recognitionRef.current;
   if(!recognition){ alert("المتصفح الحالي لا يدعم الإدخال الصوتي. جرّب Google Chrome أو Microsoft Edge."); return; }
   try{ listening ? recognition.stop() : recognition.start(); }catch{}
 }

 function speak(text){
   if(typeof window === "undefined" || !window.speechSynthesis) return;
   window.speechSynthesis.cancel();
   const utterance=new SpeechSynthesisUtterance(text);
   utterance.lang="ar-SA";
   utterance.rate=0.92;
   utterance.pitch=1;
   const voices=window.speechSynthesis.getVoices();
   const voice=voices.find(v=>v.lang?.toLowerCase()==="ar-sa") || voices.find(v=>v.lang?.toLowerCase().startsWith("ar"));
   if(voice) utterance.voice=voice;
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
   if(!res.ok) throw new Error();
   const data=await res.json();
   const reply=data.reply || data.output || data.text || "عذرًا، لم يصل رد من المساعد حاليًا.";
   const cleanReply=String(reply).replace(/^=/,"");
   setMessages(prev=>[...prev,{role:"assistant",text:cleanReply}]);
   speak(cleanReply);
  }catch{
   setMessages(prev=>[...prev,{role:"assistant",text:"عذرًا، تعذر الاتصال بالمساعد التعليمي حاليًا. حاول مرة أخرى."}]);
  }finally{setLoading(false);}
 }

 return <main className="shell ai-shell" dir="rtl">
  <section className="hero ai-hero modern-ai">
   <BrandHeader />
   <div className="tech-line" />
   <div className="ai-icon" aria-hidden="true">🤖</div>
   <h1>المساعد التعليمي الذكي</h1>
   <p className="hero-description">إدارة التعليم المستمر — إدارة التعليم بنجران</p>
   <div className="chat-box modern-chat">
    <div className="chat-header"><span className="online-dot" /> المساعد متاح الآن</div>
    <div className="chat-messages" aria-live="polite">
      {messages.length===0 && <div className="chat-welcome"><strong>مرحبًا بك 👋</strong><span>كيف يمكنني مساعدتك اليوم؟ اكتب سؤالك أو تحدث بالصوت.</span></div>}
      {messages.map((m,i)=><div key={i} className={`chat-message ${m.role}`}><span>{m.text}</span>{m.role==="assistant" && <button type="button" className="speak-replay" onClick={()=>speak(m.text)} aria-label="إعادة تشغيل الرد الصوتي">🔊</button>}</div>)}
      {loading && <div className="chat-message assistant"><span>جاري إعداد الرد...</span></div>}
    </div>
    <form className="ai-chat-input" onSubmit={sendMessage}>
      <input value={message} onChange={e=>setMessage(e.target.value)} placeholder="اكتب سؤالك هنا..." aria-label="اكتب سؤالك هنا" disabled={loading}/>
      <button type="button" onClick={toggleListening} className={listening?"voice-active":""} aria-label={listening?"إيقاف التسجيل":"التحدث صوتيًا"}>{listening?"⏹️":"🎤"}</button>
      <button type="submit" disabled={loading || !message.trim()}>{loading?"...":"إرسال"}</button>
    </form>
    <div className="voice-status" aria-live="polite">{listening?"🎙️ أستمع إليك الآن...":speaking?"🔊 المساعد يتحدث الآن...":""}</div>
   </div>
   <div className="home-footer"><span>الإدارة العامة للتعليم بنجران</span></div>
  </section>
 </main>
}
