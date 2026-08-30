"use client";

import { useEffect, useRef, useState } from "react";
import BrandHeader from "./components/BrandHeader";

export default function Home(){
 const [message,setMessage]=useState("");
 const [messages,setMessages]=useState([]);
 const [loading,setLoading]=useState(false);
 const [listening,setListening]=useState(false);
 const [speaking,setSpeaking]=useState(false);
 const [audioReady,setAudioReady]=useState(false);
 const recognitionRef=useRef(null);

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

 async function playAudio(base64, mime="audio/mpeg"){
  if(!base64) return;
  try{
   const binary=atob(base64); const bytes=new Uint8Array(binary.length);
   for(let i=0;i<binary.length;i++) bytes[i]=binary.charCodeAt(i);
   const blob=new Blob([bytes],{type:mime});
   const url=URL.createObjectURL(blob); const audio=new Audio(url);
   setAudioReady(false); setSpeaking(true);
   audio.onended=()=>{setSpeaking(false);setAudioReady(true);URL.revokeObjectURL(url)};
   audio.onerror=()=>{setSpeaking(false);setAudioReady(false);URL.revokeObjectURL(url)};
   await audio.play();
  }catch{setSpeaking(false);setAudioReady(false);}
 }

 async function sendMessage(e){
  e?.preventDefault(); const text=message.trim();
  if(!text||loading)return;
  setMessages(p=>[...p,{role:"user",text}]); setMessage(""); setLoading(true); setAudioReady(false);
  try{
   const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text})});
   const data=await res.json();
   if(!res.ok) throw new Error(data?.error||"request failed");
   const reply=String(data.reply||"").trim()||"عذرًا، لم يصل رد من المساعد حاليًا.";
   setMessages(p=>[...p,{role:"assistant",text:reply,audio:data.audio||null}]);
   if(data.audio) await playAudio(data.audio,data.audioType||"audio/mpeg");
  }catch{setMessages(p=>[...p,{role:"assistant",text:"عذرًا، تعذر الاتصال بالمساعد التعليمي حاليًا. حاول مرة أخرى."}]);}
  finally{setLoading(false)}
 }

 async function replay(text){
  try{
   const res=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text})});
   const data=await res.json(); if(res.ok&&data.audio) await playAudio(data.audio,data.audioType||"audio/mpeg");
  }catch{}
 }

 return <main className="shell ai-shell" dir="rtl"><section className="hero ai-hero modern-ai"><BrandHeader/><div className="tech-line"/><div className="ai-icon" aria-hidden="true">🤖</div><h1>المساعد الذكي التعليمي</h1><p className="hero-description">إدارة التعليم بمنطقة نجران</p><div className="chat-box modern-chat"><div className="chat-header"><span className="online-dot"/> المساعد متاح الآن</div><div className="chat-messages" aria-live="polite">{messages.length===0&&<div className="chat-welcome"><strong>مرحبًا بك 👋</strong><span>كيف يمكنني مساعدتك اليوم؟ اكتب سؤالك أو تحدث بالصوت.</span></div>}{messages.map((m,i)=><div key={i} className={`chat-message ${m.role}`}><span>{m.text}</span>{m.role==="assistant"&&<button type="button" className="speak-replay" onClick={()=>m.audio?playAudio(m.audio,m.audioType||"audio/mpeg"):replay(m.text)} aria-label="تشغيل الرد الصوتي">🔊</button>}</div>)}{loading&&<div className="chat-message assistant"><span>جاري إعداد الرد...</span></div>}</div><form className="ai-chat-input" onSubmit={sendMessage}><input value={message} onChange={e=>setMessage(e.target.value)} placeholder="اكتب سؤالك هنا..." aria-label="اكتب سؤالك هنا" disabled={loading}/><button type="button" onClick={toggleListening} className={listening?"voice-active":""} aria-label={listening?"إيقاف التسجيل":"التحدث صوتيًا"}>{listening?"⏹️":"🎤"}</button><button type="submit" disabled={loading||!message.trim()}>{loading?"...":"إرسال"}</button></form><div className="voice-status" aria-live="polite">{listening?"🎙️ أستمع إليك الآن...":speaking?"🔊 المساعد يتحدث الآن...":audioReady?"🔊 الصوت جاهز":""}</div></div><div className="home-footer"><span>إدارة التعليم بمنطقة نجران</span></div></section></main>
}
