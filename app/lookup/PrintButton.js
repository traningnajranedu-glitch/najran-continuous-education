"use client";

export default function PrintButton() {
  return (
    <button type="button" className="print-button" onClick={() => window.print()}>
      🖨 طباعة / حفظ PDF
    </button>
  );
}
