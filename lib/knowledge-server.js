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

export async function searchKnowledgeFromSupabase(query) {
  if (!url || !key) return [];
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.from("knowledge_base").select("id,title,category,service,content,keywords,source_url,document_url,status,verified_at").eq("status", "active").order("updated_at", { ascending: false }).limit(200);
  if (error || !data) return [];

  const q = normalizeArabic(query);
  if (!q) return [];
  const terms = q.split(/\s+/).filter((term) => term.length > 1);

  return data
    .map((item) => {
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
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ item }) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      service: item.service,
      content: item.content,
      keywords: item.keywords || [],
      sourceUrl: item.source_url,
      documentUrl: item.document_url,
      verifiedAt: item.verified_at,
    }));
}
