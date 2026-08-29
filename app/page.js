"use client";

import { useState } from "react";
import BrandHeader from "./components/BrandHeader";

const WEBHOOK_URL = "https://abrahem606.app.n8n.cloud/webhook/najran-education-ai";

export default function Home(){
 const [message,setMessage]=useState("");
 const [messages,setMessages]=useState([]);
 const [loading,setLoading]=useState(false);

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
   setMessages(prev=>[...prev,{role:"assistant",text:String(reply).replace(/^=/,"")}]);
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
      {messages.length===0 && <div className="chat-welcome"><strong>مرحبًا بك 👋</strong><span>كيف يمكنني مساعدتك اليوم؟</span></div>}
      {messages.map((m,i)=><div key={i} className={`chat-message ${m.role}`}><span>{m.text}</span></div>)}
      {loading && <div className="chat-message assistant"><span>جاري إعداد الرد...</span></div>}
    </div>
    <form className="ai-chat-input" onSubmit={sendMessage}>
      <input value={message} onChange={e=>setMessage(e.target.value)} placeholder="اكتب سؤالك هنا..." aria-label="اكتب سؤالك هنا" disabled={loading}/>
      <button type="button" aria-label="التحدث صوتيًا" disabled>🎤</button>
      <button type="submit" disabled={loading || !message.trim()}>{loading?"...":"إرسال"}</button>
    </form>
   </div>
   <div className="home-footer"><span>الإدارة العامة للتعليم بمنطقة نجران</span></div>
  </section>
 </main>
}
