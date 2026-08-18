import Link from "next/link";
import BrandHeader from "./components/BrandHeader";

export default function Home(){
 return <main className="shell home-shell">
  <section className="hero">
   <BrandHeader />
   <div className="hero-badge"><span>استعلام إلكتروني</span><span className="badge-dot" /></div>
   <h1>استعلام ترشيح المعلمين</h1>
   <p className="hero-description">تحقق من حالة ترشيحك للتدريس في برامج التعليم المستمر بمنطقة نجران</p>
   <form action="/lookup" method="get" className="lookup">
    <div className="input-wrap">
      <span className="input-icon">⌕</span>
      <input name="id" inputMode="numeric" placeholder="أدخل رقم السجل المدني" required />
    </div>
    <button>استعلام <span>←</span></button>
   </form>
   <div className="home-footer">
    <span>خدمة رقمية • التعليم المستمر</span>
    <Link className="adminLink" href="/admin">دخول الإدارة</Link>
   </div>
  </section>
 </main>
}
