import BrandHeader from "./components/BrandHeader";

export default function Home(){
 return <main className="shell ai-shell">
  <section className="hero ai-hero">
   <BrandHeader />
   <div className="hero-badge"><span>خدمة ذكية</span><span className="badge-dot" /></div>
   <div className="ai-icon" aria-hidden="true">🤖</div>
   <h1>المساعد التعليمي الذكي</h1>
   <p className="hero-description">مساعدك الذكي للحصول على المعلومات والخدمات التعليمية التابعة للإدارة العامة للتعليم بمنطقة نجران</p>
   <div className="quick-actions">
    <button type="button">الخدمات التعليمية</button>
    <button type="button">الأسئلة الشائعة</button>
    <button type="button">التواصل مع الجهة المختصة</button>
   </div>
   <div className="chat-box">
    <div className="chat-welcome">
      <strong>مرحبًا بك 👋</strong>
      <span>كيف يمكنني مساعدتك اليوم؟</span>
    </div>
    <div className="ai-chat-input">
      <input name="message" placeholder="اكتب سؤالك هنا..." aria-label="اكتب سؤالك هنا" />
      <button type="button" aria-label="التحدث صوتيًا">🎤</button>
      <button type="button">إرسال</button>
    </div>
   </div>
   <div className="home-footer">
    <span>الإدارة العامة للتعليم بمنطقة نجران</span>
   </div>
  </section>
 </main>
}
