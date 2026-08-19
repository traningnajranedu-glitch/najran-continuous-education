"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      className="print-button"
      onClick={() => window.print()}
      aria-label="طباعة أو حفظ نتيجة الترشيح بصيغة PDF"
    >
      🖨 طباعة / حفظ PDF
    </button>
  );
}
