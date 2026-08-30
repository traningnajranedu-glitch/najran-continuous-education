"use client";

import { useEffect, useRef, useState } from "react";
import BrandHeader from "./components/BrandHeader";

const SERVICES = [
  {
    icon: "🎓",
    title: "خدمات الطلاب والطالبات",
    options: [
      "القبول والتسجيل",
      "التحويل والنقل بين المدارس",
      "الغياب والانقطاع",
      "الخدمات والبرامج التعليمية",
    ],
  },
  {
    icon: "👩‍🏫",
    title: "خدمات المعلمين والمعلمات",
    options: [
      "النقل والتكليف",
      "الترشيح والبرامج التدريبية",
      "الإجازات وشؤون الموظفين",
      "الاستفسارات المهنية والتعليمية",
    ],
  },
  {
    icon: "🏫",
    title: "الخدمات التعليمية والمدارس",
    options: [
      "الخدمات المدرسية",
      "التجهيزات والدعم التعليمي",
      "الأنشطة والبرامج التعليمية",
      "التوجيه والإرشاد",
    ],
  },
  {
    icon: "💬",
    title: "الاستفسارات والتوجيه",
    options: [
      "تحديد الجهة المختصة",
      "معرفة الإجراء المناسب",
      "الاستفسار عن خدمة غير مدرجة",
      "التواصل مع الجهة المختصة",
    ],
  },
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
   r.lang="ar-SA";
   r.continuous=false;
   r.interimResults=false;
   r.onstart=()=>setListening(true);
   r.onend=()=>setListening(false);
   r.onerror=()=>setListening(false);
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
  const binary=atob(base64);
  const bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes],{type:mime}));
 }

 async function playAudio(base64,mime="audio/mpeg"){
  if(!base64)return false;
  try{
   if(audioRef.current){
    audioRef.current.pause();
    if(audioRef.current.src?.startsWith("blob:"))URL.revokeObjectURL(audioRef.current.src);
   }
   const audio=new Audio(makeAudioUrl(base64,mime));
   audio.preload="auto";
   audioRef.current=audio;
   audio.onplay=()=>setSpeaking(true);
   audio.onended=()=>{
    setSpeaking(false);
    if(audio.src?.startsWith("blob:"))URL.revokeObjectURL(audio.src);
   };
   audio.onerror=()=>setSpeaking(false);
   await audio.play();
   return true;
  }catch{return false;}
 }

 async function sendMessageText(text){
  const value=String(text||"").trim();
  if(!value||loading)return;
  setMessages(p=>[...p,{role:"user",text:value}]);
  setMessage("");
  setLoading(true);
  try{
   const res=await fetch("/api/chat",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({message:value})
   });
   const data=await res.json();
   if(!res.ok)throw new Error(data?.error||"request failed");
   const reply=String(data.reply||"").trim()||"عذرًا، لم يصل رد من المساعد حاليًا.";
   setMessages(p=>[...p,{role:"assistant",text:reply,audio:data.audio||null,audioType:data.audioType||"audio/mpeg"}]);
   if(data.audio)await playAudio(data.audio,data.audioType||"audio/mpeg");
  }catch{
   setMessages(p=>[...p,{role:"assistant",text:"عذرًا، تعذر الاتصال بالمساعد التعليمي حاليًا.",audio:null}]);
  }finally{setLoading(false);}
 }

 async function sendMessage(e){
  e?.preventDefault();
  await sendMessageText(message);
 }

 function selectService(serviceIndex){
  setSelectedService(serviceIndex);
 }

 function selectOption(option){
  const service=SERVICES[selectedService];
  const prompt=`أريد الاستفسار عن «${option}» ضمن ${service.title} في إدارة التعليم بمنطقة نجران. اشرح لي الخدمة والإجراء والمتطلبات والجهة المختصة، واعتمد فقط على المعلومات الموثوقة والمتاحة لديك.`;
  sendMessageText(prompt);
 }

 function resetServicePath(){
  setSelectedService(null);
 }

 const activeService=selectedService===null?null:SERVICES[selectedService];

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
       <div className="flow-title">اختر المجال الذي تريد الاستفسار عنه</div>
       <div className="service-grid" aria-label="الخدمات التفاعلية">
        {SERVICES.map((s,i)=><button key={s.title} type="button" className="service-card" onClick={()=>selectService(i)} disabled={loading}>
         <span className="service-icon">{s.icon}</span>
         <span className="service-title">{s.title}</span>
         <span className="service-arrow">←</span>
        </button>)}
       </div>
      </>
    ) : (
      <div className="service-options-panel">
       <div className="flow-breadcrumb"><button type="button" className="flow-back" onClick={resetServicePath} disabled={loading}>→ المجالات الرئيسية</button></div>
       <div className="flow-title"><span>{activeService.icon}</span> اختر الخدمة المطلوبة في {activeService.title}</div>
       <div className="option-grid">
        {activeService.options.map(option=><button key={option} type="button" className="option-card" onClick={()=>selectOption(option)} disabled={loading}>
          <span>{option}</span><strong>←</strong>
        </button>)}
       </div>
       <div className="flow-note">بعد اختيار الخدمة سأوجّهك للخطوات والمعلومات المناسبة، ويمكنك متابعة الحوار صوتيًا أو كتابيًا.</div>
      </div>
    )}
   </div>

   <div className="chat-box modern-chat">
    <div className="chat-header"><span className="online-dot"/> المساعد متاح الآن</div>
    <div className="chat-messages" aria-live="polite">
     {messages.length===0&&<div className="chat-welcome"><strong>مرحبًا بك 👋</strong><span>اختر مجالًا من الأعلى أو اكتب سؤالك مباشرة، وسأساعدك خطوة بخطوة.</span></div>}
     {messages.map((m,i)=><div key={i} className={`chat-message ${m.role}`}>
      <div>
       <div>{m.text}</div>
       {m.role==="assistant"&&m.audio&&<div className="audio-actions">
        <button type="button" className="speak-replay" onClick={()=>playAudio(m.audio,m.audioType||"audio/mpeg")}>🔊 تشغيل</button>
        <audio controls preload="none" src={`data:${m.audioType||"audio/mpeg"};base64,${m.audio}`} />
       </div>}
      </div>
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
