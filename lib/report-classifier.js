const RULES = {
  students: {
    label: "أداء الطلاب",
    keywords: ["طالب", "الطلاب", "طالبة", "الطالبات", "درجة", "درجات", "تحصيل", "اختبار", "حضور", "غياب", "مواظبة", "مادة", "صف", "فصل", "نسبة نجاح"],
    strong: ["درجة", "درجات", "حضور", "غياب", "تحصيل", "مادة", "صف", "فصل"],
  },
  teachers: {
    label: "أداء المعلمين",
    keywords: ["معلم", "المعلمين", "معلمة", "المعلمات", "الاسم", "سجل المدني", "السجل المدني", "رقم الهوية", "مدرسة الترشيح", "حالة الترشيح", "التخصص", "الترشيح", "مرشح", "غير مرشح", "أداء مهني", "تقييم المعلم"],
    strong: ["سجل المدني", "السجل المدني", "رقم الهوية", "مدرسة الترشيح", "حالة الترشيح", "الترشيح", "التخصص", "معلم", "معلمة", "أداء مهني", "تقييم المعلم"],
  },
  environment: {
    label: "البيئة المدرسية",
    keywords: ["مبنى", "صيانة", "سلامة", "نظافة", "مختبر", "تجهيزات", "مرفق", "بيئة", "أمن وسلامة", "إنارة", "تكييف", "دورات مياه"],
    strong: ["صيانة", "سلامة", "نظافة", "تجهيزات", "مبنى", "مرفق"],
  },
  activities: {
    label: "الأنشطة والإنجازات",
    keywords: ["نشاط", "أنشطة", "مبادرة", "فعالية", "إنجاز", "مسابقة", "برنامج", "شراكة", "تكريم", "معرض"],
    strong: ["نشاط", "مبادرة", "فعالية", "إنجاز", "مسابقة", "برنامج"],
  },
  requests: {
    label: "متابعة الطلبات والخدمات",
    keywords: ["رقم الطلب", "طلب", "الخدمة", "حالة الطلب", "حالة", "مستفيد", "المستفيد", "تاريخ الحالة", "تحت الإجراء", "مكتمل", "ملاحظات"],
    strong: ["رقم الطلب", "الخدمة", "حالة الطلب", "تاريخ الحالة", "تحت الإجراء", "مستفيد"],
  },
};

function norm(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ");
}

function similarityScore(text, rule) {
  const source = norm(text);
  let score = 0;
  for (const word of rule.keywords) if (source.includes(norm(word))) score += 1;
  for (const word of rule.strong) if (source.includes(norm(word))) score += 3;
  return score;
}

function isMeaningfulRow(row) {
  return Object.entries(row || {}).some(([key, value]) => {
    const k = norm(key).replace(/^__empty_?/g, "");
    const v = norm(value);
    return k && v && !/^__empty/.test(k);
  });
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 5000).filter(isMeaningfulRow).map((row) => {
    const out = {};
    for (const [key, value] of Object.entries(row || {})) {
      const cleanKey = norm(key);
      if (!cleanKey || /^__empty/.test(cleanKey)) continue;
      out[cleanKey] = norm(value);
    }
    return out;
  }).filter(isMeaningfulRow);
}

function getColumnText(rows) {
  const keys = new Set();
  for (const row of rows.slice(0, 100)) Object.keys(row || {}).forEach((k) => keys.add(k));
  return Array.from(keys).join(" | ");
}

function duplicateCount(rows) {
  const seen = new Set();
  let duplicates = 0;
  for (const row of rows) {
    const signature = Object.keys(row || {}).sort().map((k) => `${k}:${norm(row[k])}`).join("|");
    if (seen.has(signature)) duplicates += 1;
    else seen.add(signature);
  }
  return duplicates;
}

function findValue(row, names) {
  const entries = Object.entries(row || {});
  for (const name of names) {
    const target = norm(name);
    const found = entries.find(([key]) => key === target || key.includes(target));
    if (found) return found[1];
  }
  return "";
}

function detectFieldIssues(rows, detectedType) {
  const issues = [];
  if (!rows.length) return issues;
  const keys = Object.keys(rows[0]);

  if (detectedType === "requests" && !keys.some((k) => k.includes("رقم الطلب"))) {
    issues.push("لم يتم العثور على عمود واضح لرقم الطلب.");
  }

  if (detectedType === "teachers") {
    const civilKey = keys.find((k) => ["سجل المدني", "السجل المدني", "رقم الهوية", "الهوية"].some((x) => k === norm(x) || k.includes(norm(x))));
    const nameKey = keys.find((k) => ["الاسم", "اسم المعلم", "اسم المعلم/المعلمه", "اسم المعلم/المعلمة", "اسم"].some((x) => k === norm(x) || k.includes(norm(x))));
    const schoolKey = keys.find((k) => k.includes("مدرسة الترشيح"));
    const statusKey = keys.find((k) => k.includes("حالة الترشيح") || k === "الحالة");

    if (!nameKey) issues.push("لم يتم العثور على عمود واضح لاسم المعلم/المعلمة.");
    if (!civilKey) issues.push("لم يتم العثور على عمود واضح للسجل المدني/رقم الهوية.");
    if (!schoolKey) issues.push("لم يتم العثور على عمود واضح لمدرسة الترشيح.");

    if (civilKey) {
      const invalid = [];
      rows.slice(0, 100).forEach((r, i) => {
        const value = norm(r[civilKey]);
        if (value && !/^\d{8,15}$/.test(value)) invalid.push(i + 1);
        if (nameKey && /^\d{8,15}$/.test(norm(r[nameKey]))) invalid.push(i + 1);
      });
      const unique = [...new Set(invalid)];
      if (unique.length) issues.push(`يوجد ${unique.length} سجلًا يحتاج مراجعة في الاسم/السجل المدني (قد يكون هناك تبديل أو قيمة غير صحيحة).`);
    }

    if (!statusKey) issues.push("لم يتم العثور على عمود «حالة الترشيح»؛ لذلك لن يتم احتساب مرشح/غير مرشح.");
  }
  return issues;
}

export function classifyReport({ title = "", summary = "", fileName = "", reportType = "", rows = [] }) {
  const cleanRows = normalizeRows(rows);
  const columnText = getColumnText(cleanRows);
  const sampleText = cleanRows.slice(0, 100).map((r) => Object.values(r).join(" | ")).join(" | ");
  const corpus = [title, summary, fileName, columnText, sampleText].join(" | ");

  const scores = Object.entries(RULES)
    .map(([key, rule]) => ({ key, label: rule.label, score: similarityScore(corpus, rule) }))
    .sort((a, b) => b.score - a.score);
  const best = scores[0] || { key: "unknown", label: "غير محدد", score: 0 };
  const second = scores[1] || { score: 0 };
  const confidence = Math.min(0.99, Math.max(0.35, best.score / (best.score + second.score + 1)));

  const requestedLabel = RULES[reportType]?.label || reportType || "غير محدد";
  const mismatch = Boolean(reportType && best.key !== reportType && best.score >= 4 && best.score > second.score);
  const duplicates = duplicateCount(cleanRows);
  const issues = detectFieldIssues(cleanRows, best.key);
  if (duplicates > 0) issues.push(`يوجد ${duplicates} سجل مكرر بالكامل.`);

  const metrics = buildMetrics(cleanRows, best.key);
  const validationStatus = mismatch || issues.some((x) => !x.includes("لن يتم احتساب")) ? "review" : "ok";

  return {
    detectedType: best.key,
    detectedLabel: best.label,
    confidence: Number(confidence.toFixed(2)),
    requestedType: reportType || null,
    requestedLabel,
    mismatch,
    validationStatus,
    scores,
    rowCount: cleanRows.length,
    duplicateCount: duplicates,
    issues,
    metrics,
    columns: Array.from(new Set(cleanRows.flatMap((r) => Object.keys(r)))),
    recommendation: mismatch
      ? `نوع التقرير المقترح هو «${best.label}» بدلًا من «${requestedLabel}» بناءً على بنية الأعمدة ومحتوى البيانات.`
      : `التصنيف «${best.label}» متوافق مبدئيًا مع بنية ومحتوى البيانات.`
  };
}

function buildMetrics(rows, type) {
  if (type === "requests") {
    const statuses = {};
    const statusColumnFound = rows.length > 0 && Object.keys(rows[0]).some((k) => k === "الحالة" || k.includes("حالة الطلب"));
    for (const row of rows) {
      const status = findValue(row, ["الحالة", "حالة الطلب"]);
      if (status) statuses[status] = (statuses[status] || 0) + 1;
    }
    return { total: rows.length, statuses, statusColumnFound, statusMessage: statusColumnFound ? null : "لم يتم العثور على عمود حالة الطلب." };
  }
  if (type === "teachers") {
    const nominationStatuses = {};
    const statusColumnFound = rows.length > 0 && Object.keys(rows[0]).some((k) => k.includes("حالة الترشيح") || k === "الحالة");
    for (const row of rows) {
      const status = findValue(row, ["حالة الترشيح", "الحالة"]);
      if (status) nominationStatuses[status] = (nominationStatuses[status] || 0) + 1;
    }
    return {
      total: rows.length,
      nominationStatuses,
      statusColumnFound,
      statusMessage: statusColumnFound ? null : "لم يتم العثور على عمود «حالة الترشيح». لا يمكن احتساب مرشح/غير مرشح من هذا الملف."
    };
  }
  return { total: rows.length };
}

export { RULES };
