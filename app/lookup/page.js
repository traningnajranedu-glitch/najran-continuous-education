import { supabase } from "../../lib/supabase";
import PrintButton from "./PrintButton";

function statusType(status = "") {
  const s = String(status).trim();
  if (s.includes("غير مرشح")) return "not-selected";
  if (s.includes("تحت الإجراء")) return "pending";
  if (s.includes("معتذر")) return "apology";
  return "selected";
}

function defaultMessage(status = "") {
  const s = String(status).trim();
  if (s.includes("غير مرشح")) return "نعتذر، لم يتم ترشيحك في هذه المرحلة.";
  if (s.includes("تحت الإجراء")) return "طلبك تحت الإجراء، وسيتم تحديث الحالة عند اكتمال الإجراءات.";
  if (s.includes("معتذر")) return "تم تسجيل حالة الاعتذار عن الترشيح.";
  return "مبروك، تم ترشيحك للتدريس في التعليم المستمر.";
}

export default async function Lookup({searchParams}) {
  const id = (await searchParams).id?.replace(/\D/g, "") || "";
  let person = null, error = null;

  if (id) {
    const {data, error: e} = await supabase.rpc("lookup_candidate", {p_civil_id: id});
    error = e;
    person = data?.[0] || null;
  }

  const type = statusType(person?.status);
  const message = person?.message || defaultMessage(person?.status);

  return <main className="shell">
    <section className={`card lookup-card ${person ? `status-${type}` : ""}`}>
      <div className="pill">استعلام الترشيح</div>
      <h1>نتيجة الاستعلام</h1>

      {!id && <p>أدخل رقم السجل المدني من الصفحة الرئيسية.</p>}

      {id && person && <div className={`result ${type}`}>
        <div className="result-title">
          <span className="status-icon">
            {type === "selected" ? "✓" : type === "not-selected" ? "!" : "•"}
          </span>
          <h2>
            {type === "selected" && "تم العثور على الترشيح"}
            {type === "not-selected" && "لم يتم الترشيح"}
            {type === "pending" && "الطلب تحت الإجراء"}
            {type === "apology" && "حالة الترشيح: معتذر"}
          </h2>
        </div>

        <div className="print-content">
          <div className="print-header">
            <div className="print-org">إدارة التعليم بنجران</div>
            <div className="print-title">نتيجة الاستعلام عن الترشيح</div>
          </div>

          <div className="details">
            <p><span>الاسم</span><b>{person.name}</b></p>
            <p><span>المدرسة</span><b>{person.school || "—"}</b></p>
            <p><span>التخصص</span><b>{person.specialty || "—"}</b></p>
            <p><span>الحالة</span><b className={`status-text ${type}`}>{person.status || "—"}</b></p>
          </div>

          <div className="message">{message}</div>
          <div className="print-date">تاريخ الاستعلام: {new Date().toLocaleDateString("ar-SA")}</div>
        </div>

        <div className="print-actions">
          <PrintButton />
        </div>
      </div>}

      {id && !person && <div className="error">
        <b>لم يتم العثور على بيانات.</b><br/>
        تأكد من رقم السجل المدني، أو راجع إدارة التعليم إذا كنت تتوقع وجود ترشيح.
        {error && <small className="technical-error">تعذر الاتصال بقاعدة البيانات حاليًا.</small>}
      </div>}

      <a href="/" className="back">عودة للاستعلام</a>
    </section>
  </main>;
}
