import { createClient } from "@supabase/supabase-js";

const url = process.env.KNOWLEDGE_SUPABASE_URL;
const key = process.env.KNOWLEDGE_SUPABASE_SERVICE_ROLE_KEY;

function normalizeArabic(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreText(query, item) {
  const q = normalizeArabic(query);
  const terms = q.split(/\s+/).filter((term) => term.length > 1);
  const haystack = normalizeArabic([
    item.title,
    item.category,
    item.service,
    item.content,
    ...(item.keywords || []),
  ].join(" "));
  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) score += term.length >= 5 ? 2 : 1;
  }
  if (haystack.includes("تعليم نجران") && q.includes("نجران")) score += 2;
  if (haystack.includes("ادارات") && q.includes("ادارات")) score += 3;
  return score;
}

export async function searchKnowledgeFromSupabase(query) {
  if (!url || !key) return [];
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const q = normalizeArabic(query);
  if (!q) return [];

  const [{ data: knowledgeData, error: knowledgeError }, { data: reportData, error: reportError }] = await Promise.all([
    client.from("knowledge_base")
      .select("id,title,category,service,content,keywords,source_url,document_url,status,verified_at")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(200),
    client.from("ai_public_periodic_reports")
      .select("id,school_id,report_type,report_date,title,summary,report_data,source_file_name,status,created_at")
      .order("report_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const knowledgeItems = !knowledgeError && Array.isArray(knowledgeData) ? knowledgeData.map((item) => ({
    id: item.id,
    title: item.title,
    category: item.category,
    service: item.service,
    content: item.content,
    keywords: item.keywords || [],
    sourceUrl: item.source_url,
    documentUrl: item.document_url,
    verifiedAt: item.verified_at,
    kind: "knowledge",
  })) : [];

  const reportLabels = {
    students: "أداء الطلاب",
    teachers: "أداء المعلمين",
    environment: "البيئة المدرسية",
    activities: "الأنشطة والإنجازات",
    requests: "متابعة الطلبات والخدمات",
  };

  const reportItems = !reportError && Array.isArray(reportData) ? reportData.map((report) => ({
    id: `periodic-${report.id}`,
    title: report.title || `تقرير ${reportLabels[report.report_type] || report.report_type}`,
    category: "التقارير المدرسية الدورية",
    service: reportLabels[report.report_type] || report.report_type,
    content: [
      `التقرير معتمد بتاريخ ${report.report_date || "غير محدد"}.`,
      report.summary || "",
      report.source_file_name ? `اسم الملف: ${report.source_file_name}.` : "",
      Array.isArray(report.report_data) && report.report_data.length
        ? `بيانات التقرير: ${JSON.stringify(report.report_data).slice(0, 16000)}`
        : "",
    ].filter(Boolean).join("\n"),
    keywords: [
      "تقرير دوري",
      "تقارير مدرسية",
      reportLabels[report.report_type] || report.report_type,
      report.source_file_name || "",
    ].filter(Boolean),
    sourceUrl: null,
    documentUrl: null,
    verifiedAt: report.report_date,
    kind: "periodic_report",
  })) : [];

  return [...knowledgeItems, ...reportItems]
    .map((item) => ({ item, score: scoreText(query, item) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.item.kind !== b.item.kind) return a.item.kind === "periodic_report" ? -1 : 1;
      return 0;
    })
    .slice(0, 8)
    .map(({ item }) => item);
}
