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
 useEffect(()=>{if(typeof window==="undefined")return;const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return;const r=new SR();r.lang="ar-SA";r.continuous=false;r.interimResults=false;r.onstart=()=>setListening(true);r.onend=()=>setListening(false);r.onerror=()=>setListening(false);r.onresult=e=>setMessage(e.results?.[0]?.[0]?.transcript||"");recognitionRef.current=r;return()=>{try{r.stop()}catch{}}},[]);
 function toggleListening(){const r=recognitionRef.current;if(!r){alert("المتصفح الحالي لا يدعم الإدخال الصوتي. جرّب Google Chrome أو Microsoft Edge.");return}try{listening?r.stop():r.start()}catch{}}
 function speak(text){if(typeof window==="undefined"||!window.speechSynthesis)return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="ar-SA";u.rate=.92;u.pitch=1;const v=window.speechSynthesis.getVoices();const voice=v.find(x=>x.lang?.toLowerCase()==="ar-sa")||v.find(x=>x.lang?.toLowerCase().startsWith("ar"));if(voice)u.voice=voice;u.onstart=()=>setSpeaking(true);u.onend=()=>setSpeaking(false);u.onerror=()=>setSpeaking(false);window.speechSynthesis.speak(u)}
 async function sendMessage(e){e?.preventDefault();const text=message.trim();if(!text||loading)return;setMessages(p=>[...p,{role:"user",text}]);setMessage("");setLoading(true);try{const res=await fetch(WEBHOOK_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text})});if(!res.ok)throw new Error();const data=await res.json();const reply=data.reply||data.output||data.text||"عذرًا، لم يصل رد من المساعد حاليًا.";const clean=String(reply).replace(/^=/,"");setMessages(p=>[...p,{role:"assistant",text:clean}]);speak(clean)}catch{setMessages(p=>[...p,{role:"assistant",text:"عذرًا، تعذر الاتصال بالمساعد التعليمي حاليًا. حاول مرة أخرى."}])}finally{setLoading(false)}}
 return <main className="shell ai-shell" dir="rtl"><section className="hero ai-hero modern-ai"><BrandHeader/><div className="tech-line"/><div className="ai-icon" aria-hidden="true">🤖</div><h1>المساعد التعليمي الذكي</h1><p className="hero-description">إدارة التعليم بنجران</p><div className="chat-box modern-chat"><div className="chat-header"><span className="online-dot"/> المساعد متاح الآن</div><div className="chat-messages" aria-live="polite">{messages.length===0&&<div className="chat-welcome"><strong>مرحبًا بك 👋</strong><span>كيف يمكنني مساعدتك اليوم؟ اكتب سؤالك أو تحدث بالصوت.</span></div>}{messages.map((m,i)=><div key={i} className={`chat-message ${m.role}`}><span>{m.text}</span>{m.role==="assistant"&&<button type="button" className="speak-replay" onClick={()=>speak(m.text)} aria-label="إعادة تشغيل الرد الصوتي">🔊</button>}</div>)}{loading&&<div className="chat-message assistant"><span>جاري إعداد الرد...</span></div>}</div><form className="ai-chat-input" onSubmit={sendMessage}><input value={message} onChange={e=>setMessage(e.target.value)} placeholder="اكتب سؤالك هنا..." aria-label="اكتب سؤالك هنا" disabled={loading}/><button type="button" onClick={toggleListening} className={listening?"voice-active":""} aria-label={listening?"إيقاف التسجيل":"التحدث صوتيًا"}>{listening?"⏹️":"🎤"}</button><button type="submit" disabled={loading||!message.trim()}>{loading?"...":"إرسال"}</button></form><div className="voice-status" aria-live="polite">{listening?"🎙️ أستمع إليك الآن...":speaking?"🔊 المساعد يتحدث الآن...":""}</div></div><div className="home-footer"><span>الإدارة العامة للتعليم بنجران</span></div></section></main>
}
