// AI Coding Assistant: foydalanuvchi kod yuborsa (yoki "Fix"/"Explain"/
// "Optimize" va h.k. buyruq bersa), Gemini orqali tahlil/o'zgartirish
// qilinadi. Har bir chat uchun "oxirgi kod" saqlanadi (code_reviews) —
// keyingi buyruqlar (Fix -> Optimize -> Explain kabi zanjir) shu ustida
// ishlaydi. Bilim bazasi (code_knowledge_entries) loyiha konvensiyalarini
// har bir chaqiruvga kontekst sifatida qo'shadi.

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { codeKnowledgeEntries, codeReviews, users } from "@/db/schema";
import { generateJson, type GeminiSchema } from "./gemini";

const OWNER_TELEGRAM_ID = process.env.ALLOWED_TELEGRAM_ID;

export type CodeCommand =
  | "review"
  | "fix"
  | "explain"
  | "optimize"
  | "unit-test"
  | "integration-test"
  | "readme"
  | "docs"
  | "api-docs";

const COMMAND_ALIASES: Record<string, CodeCommand> = {
  fix: "fix",
  explain: "explain",
  optimize: "optimize",
  test: "unit-test",
  "unit test": "unit-test",
  "unit tests": "unit-test",
  "integration test": "integration-test",
  "integration tests": "integration-test",
  readme: "readme",
  docs: "docs",
  documentation: "docs",
  "api docs": "api-docs",
  "api documentation": "api-docs",
};

export function matchCodeCommand(text: string): CodeCommand | null {
  const normalized = text.trim().toLowerCase();
  return COMMAND_ALIASES[normalized] ?? null;
}

// Yakka o'zi kod ekanligiga deyarli kafolat beradigan naqshlar (funksiya/
// klass ta'rifi, import, HTML teg va h.k.) — indentatsiyaga asoslangan
// tillar (Python) uchun ayniqsa muhim, chunki ular jingalak qavs/nuqta-vergul
// ishlatmaydi.
const STRONG_CODE_PATTERNS = [
  /\bdef\s+\w+\s*\(/,
  /\bfunction\s+\w+\s*\(/,
  /\bclass\s+\w+/,
  /\bimport\s+[\w{}, *]+\s+from\b/,
  /#include\s*[<"]/,
  /\bpublic\s+(static\s+)?\w+\s+\w+\s*\(/,
  /\bSELECT\b[\s\S]+\bFROM\b/i,
  /\bfn\s+\w+\s*\(/,
  /\bpackage\s+main\b/,
  /<\/?[a-zA-Z][\w-]*(\s[^<>]*)?>/,
];

// Yakkasi yetarli emas, lekin bir nechtasi birga kelsa kod ekanligini
// ko'rsatadigan zaifroq naqshlar.
const WEAK_CODE_PATTERNS = [
  /\bconst\s+\w+\s*=/,
  /\blet\s+\w+\s*=/,
  /\bvar\s+\w+\s*=/,
  /=>/,
  /;\s*$/m,
  /\{\s*$/m,
  /^\}/m,
  /:\s*$/m, // python-uslubidagi blok sarlavhasi (if/for/def/class)
  /^\s{2,}\S/m, // indentatsiya bilan boshlangan qator
];

function looksLikeCode(text: string): boolean {
  const lineCount = text.trim().split("\n").length;
  if (lineCount < 2 && text.length < 60) return false;
  if (STRONG_CODE_PATTERNS.some((p) => p.test(text))) return true;
  let weakHits = 0;
  for (const pattern of WEAK_CODE_PATTERNS) {
    if (pattern.test(text)) weakHits++;
    if (weakHits >= 3) return true;
  }
  return false;
}

function extractFencedCode(text: string): string | null {
  const match = text.match(/```[a-zA-Z0-9_+-]*\n?([\s\S]*?)```/);
  return match ? match[1].trim() : null;
}

// Xabar kod ekanligini aniqlaydi: avval ``` bilan o'ralgan blokni qidiradi
// (ishonchli), topilmasa butun xabarni kod-belgilari bo'yicha taxmin qiladi
// (best-effort — noaniq holatlarda oddiy savol kod deb noto'g'ri
// aniqlanishi mumkin).
export function extractCode(text: string): string | null {
  const fenced = extractFencedCode(text);
  if (fenced) return fenced;
  const trimmed = text.trim();
  return looksLikeCode(trimmed) ? trimmed : null;
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

export async function getCodeKnowledgeContext(): Promise<string> {
  const ownerId = await getOwnerId();
  if (!ownerId) return "(bilim bazasi yo'q)";

  const [[user], entries] = await Promise.all([
    db
      .select({ codeAssistantSystemPrompt: users.codeAssistantSystemPrompt })
      .from(users)
      .where(eq(users.id, ownerId))
      .limit(1),
    db
      .select({ title: codeKnowledgeEntries.title, content: codeKnowledgeEntries.content })
      .from(codeKnowledgeEntries)
      .where(eq(codeKnowledgeEntries.userId, ownerId))
      .orderBy(desc(codeKnowledgeEntries.updatedAt)),
  ]);

  const parts: string[] = [];
  if (user?.codeAssistantSystemPrompt?.trim()) {
    parts.push(`Qo'shimcha ko'rsatma: ${user.codeAssistantSystemPrompt.trim()}`);
  }
  if (entries.length > 0) {
    parts.push(
      entries.map((e) => `### ${e.title}\n${e.content}`).join("\n\n")
    );
  }
  return parts.length > 0 ? parts.join("\n\n") : "(bilim bazasi hali bo'sh)";
}

const RESPONSE_SCHEMA: GeminiSchema = {
  type: "object",
  properties: {
    language: {
      type: "string",
      description: "Aniqlangan dasturlash tili (masalan: Python, TypeScript, Go)",
    },
    message: {
      type: "string",
      description:
        "Tahlil/tushuntirish/tavsiya matni (kod EMAS), oxirida ⭐ Code Quality, ⭐ Performance, ⭐ Security (100 ballik) baholari bilan",
    },
    code: {
      type: "string",
      description:
        "Foydalanuvchiga ko'rsatiladigan kod (tuzatilgan/optimallashtirilgan/test/hujjat kodi). Kod qaytarish shart bo'lmasa, bo'sh satr.",
    },
  },
  required: ["language", "message", "code"],
};

const SCORE_INSTRUCTION =
  "`message` maydoni HAR DOIM oxirida aynan quyidagi 3 qatorni o'z ichiga olishi SHART (ballarni kod sifatiga qarab xolisona ber):\n⭐ Code Quality: X/100\n⭐ Performance: X/100\n⭐ Security: X/100";

const COMMAND_INSTRUCTIONS: Record<CodeCommand, string> = {
  review:
    "Kodni professional dasturchi sifatida tahlil qil: bug (xato)larni top, aniq xato bo'lsa tushuntir, xavfsizlik tahlili (Security Analysis), performance tahlili, umumiy code review va best practices tavsiyalari ber. `code` maydonini BO'SH qoldir — bu bosqichda faqat tahlil kerak, kod qaytarma.",
  fix: "Koddagi barcha bug/xatolarni top va tuzat. `code` maydonida FAQAT to'liq tuzatilgan kodni ber. `message` maydonida nima o'zgartirilgani va sababini qisqacha tushuntir.",
  explain:
    "Kodni qator-qatorlab yoki mantiqiy bloklarga bo'lib tushuntir — har bir muhim qism nima qilishini oddiy tilda yoz. `code` maydonida asl kodni (xohlasang izohlar bilan) qaytarsang bo'ladi.",
  optimize:
    "Kodni optimallashtir: tezroq ishlashi va tozaroq/o'qilishi oson bo'lishi uchun qayta yoz. `code` maydonida optimallashtirilgan kodni ber. `message` maydonida qanday optimallashtirish qilinganini tushuntir.",
  "unit-test":
    "Ushbu kod uchun unit testlar yoz — kodning tiliga mos test freymvorkda (Python->pytest, JavaScript/TypeScript->Jest, Java->JUnit, C#->xUnit, Go->testing paketi, Rust->#[test], C++->Google Test kabi). `code` maydonida test kodini ber.",
  "integration-test":
    "Ushbu kod uchun integration testlar yoz (real bog'liqliklar/oqim bilan ishlashni tekshiradigan). Kodning tiliga mos freymvorkdan foydalan. `code` maydonida test kodini ber.",
  readme:
    "Ushbu kod/loyiha uchun professional README.md matnini yoz (qisqacha tavsif, o'rnatish, ishlatish misollari, talablar). `code` maydonida to'liq README matnini Markdown formatida ber, `language` maydonini \"markdown\" deb belgila.",
  docs: "Ushbu kod uchun professional hujjatlashtirish (docstring/JSDoc/XML doc kabi, kodning tiliga mos) qo'sh. `code` maydonida to'liq hujjatlashtirilgan kod versiyasini ber.",
  "api-docs":
    "Agar bu API/endpoint kodi bo'lsa, API hujjatini yoz (so'rov/javob formatlari, parametrlar, status kodlari, misollar). Agar kod API bilan bog'liq bo'lmasa, shuni `message`da ayt. `code` maydonida API hujjatini Markdown formatida ber.",
};

export async function runCodeAssistant(
  command: CodeCommand,
  code: string,
  knowledgeContext: string
): Promise<{ language: string; message: string; code: string }> {
  const prompt = [
    "Sen professional dasturchi va kod bo'yicha AI yordamchisan. Quyidagi kodni tahlil qil/qayta ishla.",
    "",
    `=== VAZIFA ===\n${COMMAND_INSTRUCTIONS[command]}`,
    "",
    SCORE_INSTRUCTION,
    "",
    `=== LOYIHA BILIM BAZASI / QO'SHIMCHA KO'RSATMALAR ===\n${knowledgeContext}`,
    "",
    `=== KOD ===\n${code}`,
  ].join("\n");

  return generateJson<{ language: string; message: string; code: string }>({
    prompt,
    schema: RESPONSE_SCHEMA,
    temperature: 0.3,
  });
}

export async function saveCodeReview(
  chatId: number,
  language: string,
  code: string,
  review: string
): Promise<void> {
  const ownerId = await getOwnerId();
  if (!ownerId) return;
  await db.insert(codeReviews).values({
    userId: ownerId,
    chatId: BigInt(chatId),
    language,
    code,
    review,
  });
}

export async function getLatestCodeReview(
  chatId: number
): Promise<{ language: string; code: string } | null> {
  const [row] = await db
    .select({ language: codeReviews.language, code: codeReviews.code })
    .from(codeReviews)
    .where(eq(codeReviews.chatId, BigInt(chatId)))
    .orderBy(desc(codeReviews.createdAt))
    .limit(1);
  return row ?? null;
}
