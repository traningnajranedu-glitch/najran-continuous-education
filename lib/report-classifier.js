const RULES = {
  students: {
    label: "أداء الطلاب",
    keywords: ["طالب", "الطلاب", "طالبة", "الطالبات", "درجة", "درجات", "تحصيل", "اختبار", "حضور", "غياب", "مواظبة", "مادة", "صف", "فصل", "نسبة نجاح"],
    strong: ["درجة", "درجات", "حضور", "غياب", "تحصيل", "مادة", "صف", "فصل"],
  },
  teachers: {
    label: "أداء المعلمين",
    keywords: ["معلم", "المعلمين", "معلمة", "المعلمات", "أداء مهني", "تدريب", "دورة", "نصاب", "حصة", "تقييم المعلم", "الترشيح", "مرشح", "غير مرشح", "التخصص", "مدرسة الترشيح"],
    strong: ["مرشح", "غير مرشح", "الترشيح", "التخصص", "معلم", "معلمة", "أداء مهني", "تقييم المعلم"],
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
    keywords: ["رقم الطلب", "طلب", "الخدمة", "حالة الطلب", "حالة", "مستفيد", "المستفيد", "تاريخ الحالة", "تحت الإجراء", "مكتمل", "مكتمل", "ملاحظات"],
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

function normalizeRows(rows) {
  return Array.isArray(rows) ? rows.slice(0, 5000).map((row) => {
    const out = {};
    for (const [key, value] of Object.entries(row || {})) out[norm(key)] = norm(value);
    return out;
  }) : [];
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
    const signature = Object.keys(row || {}).sort().map((k) => `${k}:${norm(row[k])}`).join("|`);
    if (seen.has(signature)) duplicates += 1;
    else seen.add(signature);
  }
  return duplicates;
}

function detectFieldIssues(rows, detectedType) {
  const issues = [];
  if (!rows.length) return issues;
  const keys = Object.keys(rows[0]);
  const keyText = keys.join(" | ");

  if (detectedType === "requests" && !keys.some((k) => k.includes("رقم الطلب"))) {
    issues.push("لم يتم العثور على عمود واضح لرقم الطلب.");
  }

  if (detectedType === "teachers" && (keyText.includes("سجل المدني") || keyText.includes("السجل المدني"))) {
    const values = rows.slice(0, 50);
    const possibleMisalignment = values.some((r) => {
      const civil = r["سجل المدني"] || r["السجل المدني"] || "";
      const name = r["اسم المعلم/المعلمه"] || r["اسم المعلم/المعلمة"] || "";
      return civil && /[ء-ي]/.test(civil) && /^\d+$/.test(name);
    });
    if (possibleMisalignment) issues.push("يبدو أن بعض قيم السجل المدني واسم المعلم/المعلمة متبادلة بالنسبة إلى عناوين الأعمدة.");
  }
  return issues;
}

export function classifyReport({ title = "", summary = "", fileName = "", reportType = "", rows = [] }) {
  const cleanRows = normalizeRows(rows);
  const columnText = getColumnText(cleanRows);
  const sampleText = cleanRows.slice(0, 100).map((r) => Object.values(r).join(" | ")).join(" | ");
  const corpus = [title, summary, fileName, columnText, sampleText].join(" | ");

  const scores = Object.entries(RULES).map(([key, rule]) => ({ key, label: rule.label, score: similarityScore(corpus, rule) })).sort((a, b) => b.score - a.score);
  const best = scores[0] || { key: "unknown", label: "غير محدد", score: 0 };
  const second = scores[1] || { score: 0 };
  const total = Math.max(best.score, 1);
  const confidence = Math.min(0.99, Math.max(0.35, (best.score / (best.score + second.score + 1))));

  const requestedLabel = RULES[reportType]?.label || reportType || "غير محدد";
  const mismatch = Boolean(reportType && best.key !== reportType && best.score >= 4 && best.score > second.score);
  const duplicates = duplicateCount(cleanRows);
  const issues = detectFieldIssues(cleanRows, best.key);
  if (duplicates > 0) issues.push(`يوجد ${duplicates} سجل مكرر بالكامل.`);

  const metrics = buildMetrics(cleanRows, best.key);
  return {
    detectedType: best.key,
    detectedLabel: best.label,
    confidence: Number(confidence.toFixed(2)),
    requestedType: reportType || null,
    requestedLabel,
    mismatch,
    scores,
    rowCount: cleanRows.length,
    duplicateCount: duplicates,
    issues,
    metrics,
    columns: Array.from(new Set(cleanRows.flatMap((r) => Object.keys(r)))) ,
    recommendation: mismatch
      ? `نوع التقرير المقترح هو «${best.label}» بدلًا من «${requestedLabel}» بناءً على بنية الأعمدة ومحتوى البيانات.`
      : `التصنيف «${best.label}» متوافق مبدئيًا مع بنية ومحتوى البيانات.`
  };
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

function buildMetrics(rows, type) {
  if (type === "requests") {
    const statuses = {};
    for (const row of rows) {
      const status = findValue(row, ["الحالة", "حالة الطلب"]) || "غير محدد";
      statuses[status] = (statuses[status] || 0) + 1;
    }
    return { total: rows.length, statuses };
  }
  if (type === "teachers") {
    const statuses = {};
    for (const row of rows) {
      const status = findValue(row, ["حالة الترشيح", "الحالة"]) || "غير محدد";
      statuses[status] = (statuses[status] || 0) + 1;
    }
    return { total: rows.length, nominationStatuses: statuses };
  }
  return { total: rows.length };
}

export { RULES };
