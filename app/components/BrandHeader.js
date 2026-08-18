export default function BrandHeader({compact=false}) {
  return (
    <header className={`brand-header ${compact ? "brand-compact" : ""}`}>
      <div className="brand-logo-wrap">
        <img src="/moe-logo.jpg" alt="شعار وزارة التعليم" className="brand-logo" />
      </div>
      <div className="brand-copy">
        <div className="brand-kicker">الإدارة العامة للتعليم بمنطقة نجران</div>
        <div className="brand-title">التعليم المستمر</div>
        <div className="brand-subtitle">خدمة الاستعلام عن حالة الترشيح</div>
      </div>
    </header>
  );
}
