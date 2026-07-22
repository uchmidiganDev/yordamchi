// AI Website Analyzer: foydalanuvchi URL yuborsa, sayt HTML manba kodi va
// response headerlari asosida Gemini orqali tahlil qilinadi (haqiqiy brauzer
// render/screenshot emas — Puppeteer kabi og'ir bog'liqlik qo'shmaslik uchun,
// gemini.ts'dagi boshqa qarorlarga mos). "To'g'rila" so'ralganda oxirgi
// tahlil asosida yaxshilangan HTML/CSS yaratiladi.

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, websiteAnalyses } from "@/db/schema";
import { generateText } from "./gemini";

const MAX_HTML_CHARS = 30000;
const FETCH_TIMEOUT_MS = 10000;
const MAX_CONTENT_LENGTH = 5 * 1024 * 1024; // 5 MB

const OWNER_TELEGRAM_ID = process.env.ALLOWED_TELEGRAM_ID;

const CRITERIA = [
  "UI/UX dizayn",
  "Responsive Design",
  "Loading Speed",
  "SEO",
  "Accessibility",
  "HTML Structure",
  "Performance",
  "Security Headers",
  "Broken Links",
  "Meta Tags",
  "Open Graph",
  "Images Optimization",
  "Fonts",
  "Color Contrast",
  "Navigation",
  "Call To Action",
  "Mobile Friendly",
  "Best Practices",
];

const REPORT_FORMAT = [
  "⭐ Umumiy baho (100 ball)",
  "✅ Kuchli tomonlari",
  "❌ Kamchiliklari",
  "🚀 SEO tavsiyalari",
  "🎨 Dizayn tavsiyalari",
  "⚡ Performance tavsiyalari",
  "🔒 Xavfsizlik tavsiyalari",
  "📱 Mobile tavsiyalari",
].join("\n");

// Butun xabar faqat bitta http(s) havoladan iborat bo'lsagina URL sifatida
// qabul qilinadi (oddiy suhbatda tilga olingan havolalar bilan aralashmasin
// uchun).
export function extractSoleUrl(text: string): string | null {
  const trimmed = text.trim();
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    return url.toString();
  } catch {
    return null;
  }
}

// "To'g'rila" so'rovini apostrof/imlo variantlaridan qat'i nazar taniydi
// (to'g'rila, to'g'irla, tuzat va h.k.).
export function isFixRequest(text: string): boolean {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/['’ʻ`ʼ]/g, "");
  return (
    normalized === "togrila" ||
    normalized === "togirla" ||
    normalized === "togirlang" ||
    normalized === "togrilang" ||
    normalized.startsWith("tuzat")
  );
}

async function getOwnerId(): Promise<string | null> {
  if (!OWNER_TELEGRAM_ID) return null;
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.telegramId, BigInt(OWNER_TELEGRAM_ID)))
    .limit(1);
  return owner?.id ?? null;
}

function pickHeaders(headers: Headers): Record<string, string> {
  const wanted = [
    "content-security-policy",
    "strict-transport-security",
    "x-frame-options",
    "x-content-type-options",
    "referrer-policy",
    "permissions-policy",
    "content-type",
    "server",
  ];
  const result: Record<string, string> = {};
  for (const name of wanted) {
    const value = headers.get(name);
    if (value) result[name] = value;
  }
  return result;
}

export async function fetchSiteHtml(
  url: string
): Promise<{ html: string; headers: Record<string, string> }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; YordamchiWebsiteAnalyzer/1.0; +https://yordamchi-3upk.vercel.app)",
      },
    });
    if (!res.ok) {
      throw new Error(`Sayt ${res.status} status bilan javob berdi`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !contentType.includes("text/html")) {
      throw new Error(`Bu HTML sahifa emas (content-type: ${contentType})`);
    }
    const contentLength = Number(res.headers.get("content-length") ?? 0);
    if (contentLength > MAX_CONTENT_LENGTH) {
      throw new Error("Sahifa hajmi juda katta");
    }
    const html = await res.text();
    return {
      html: html.slice(0, MAX_HTML_CHARS),
      headers: pickHeaders(res.headers),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeWebsite(
  url: string,
  html: string,
  headers: Record<string, string>
): Promise<string> {
  const prompt = [
    `Quyidagi veb-sahifani ${CRITERIA.length} ta mezon bo'yicha tahlil qil:`,
    CRITERIA.map((c) => `- ${c}`).join("\n"),
    "",
    "DIQQAT: sen faqat HTML manba kodi va HTTP response headerlarni ko'ryapsan — sahifa vizual ko'rinishini (skrinshot) ko'rmayapsan. Rang kontrasti, dizayn va shu kabilarni HTML/CSS'dagi belgilar (class nomlari, inline style, rang qiymatlari, shrift deklaratsiyalari, viewport meta tegi, media query'lar) asosida oqilona taxmin qil va bu cheklovni hisobga ol.",
    "",
    `=== URL ===\n${url}`,
    "",
    `=== HTTP RESPONSE HEADERLAR ===\n${JSON.stringify(headers, null, 2)}`,
    "",
    `=== HTML MANBA KODI (birinchi ${html.length} belgi) ===\n${html}`,
    "",
    "Javobni AYNAN quyidagi formatda, o'zbek tilida ber (sarlavhalarni so'zma-so'z shu ko'rinishda ishlat, har bo'limda qisqa va aniq bandlar yoz, insho yozma):",
    "",
    REPORT_FORMAT,
  ].join("\n");

  return generateText({ prompt, temperature: 0.4 });
}

export async function improveWebsite(
  url: string,
  html: string,
  analysis: string
): Promise<string> {
  const prompt = [
    `Quyidagi sayt (${url}) uchun avval o'tkazilgan tahlil natijalari asosida yaxshilangan, to'liq ishlaydigan HTML sahifa yoz (CSS'ni <style> ichida joylashtir).`,
    "Tahlilda topilgan kamchiliklar va tavsiyalarni (SEO, dizayn, performance, xavfsizlik, mobile) imkon qadar hisobga ol.",
    "FAQAT to'liq HTML kodini qaytar — hech qanday izoh, tushuntirish yoki markdown ``` bilan o'rash qo'shma.",
    "",
    `=== ASL HTML ===\n${html}`,
    "",
    `=== TAHLIL NATIJASI ===\n${analysis}`,
  ].join("\n");

  const result = await generateText({ prompt, temperature: 0.3 });
  return result.replace(/^```(?:html)?\n?/i, "").replace(/```$/, "").trim();
}

export async function saveAnalysis(
  chatId: number,
  url: string,
  html: string,
  analysis: string
): Promise<void> {
  const ownerId = await getOwnerId();
  if (!ownerId) return;
  await db.insert(websiteAnalyses).values({
    userId: ownerId,
    chatId: BigInt(chatId),
    url,
    html,
    analysis,
  });
}

export async function getLatestAnalysis(
  chatId: number
): Promise<{ url: string; html: string; analysis: string } | null> {
  const [row] = await db
    .select({
      url: websiteAnalyses.url,
      html: websiteAnalyses.html,
      analysis: websiteAnalyses.analysis,
    })
    .from(websiteAnalyses)
    .where(eq(websiteAnalyses.chatId, BigInt(chatId)))
    .orderBy(desc(websiteAnalyses.createdAt))
    .limit(1);
  return row ?? null;
}
