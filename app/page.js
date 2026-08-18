import Link from "next/link";
export default function Home(){
 return <main className="shell">
  <section className="hero">
   <div className="pill">التعليم المستمر</div>
   <h1>استعلام ترشيح المعلمين</h1>
   <p>الإدارة العامة للتعليم بمنطقة نجران</p>
   <form action="/lookup" method="get" className="lookup">
    <input name="id" inputMode="numeric" placeholder="أدخل رقم السجل المدني" required />
    <button>استعلام</button>
   </form>
   <Link className="adminLink" href="/admin">دخول الإدارة</Link>
  </section>
 </main>
}