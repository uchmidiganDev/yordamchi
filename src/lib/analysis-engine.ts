// A-E tahlil (kunlik xulosa, reja, ogohlantirish, progress, motivatsiya)
// generatsiyasining umumiy "motori" — `userId`ni to'g'ridan-to'g'ri parametr
// sifatida qabul qiladi, sessiya/cookie'ga bog'liq emas (assistant.ts'dagi
// 2026-07-21'dagi qarorga mos naqsh). `src/lib/actions/ai.ts`dagi
// `runManualAnalysis()` (foydalanuvchi "Hozir tahlil qil" tugmasini bosganda)
// VA `src/app/api/cron/daily-analysis`dagi avtomatik ertalabki/kechqurungi
// tahlil ikkalasi ham shu funksiyani chaqiradi — bitta joyda saqlanadigan
// mantiq, ikkita chaqiruvchi.

import { db } from "@/db";
import { analyses } from "@/db/schema";
import { buildAiContext, formatContextForPrompt } from "./ai-context";
import { parseAnalysisContent, type AnalysisContent, type AnalysisView } from "./analysis";
import { generateJson } from "./gemini";

const SYSTEM_PROMPT = [
  "Sen \"Yordamchi\" ilovasining shaxsiy AI yordamchisisan.",
  "Javoblaring faqat o'zbek tilida (lotin yozuvida) bo'lsin.",
  "Qisqa, aniq va samimiy yoz. Faqat berilgan kontekstdagi ma'lumotlarga tayan.",
  "O'ylab topilgan vazifa yoki maqsad qo'shma.",
].join(" ");

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    xulosa: { type: "string" },
    reja: {
      type: "array",
      items: {
        type: "object",
        properties: {
          vaqt: { type: "string" },
          vazifa: { type: "string" },
        },
        required: ["vazifa"],
      },
    },
    ogohlantirishlar: { type: "array", items: { type: "string" } },
    progress: {
      type: "array",
      items: {
        type: "object",
        properties: {
          maqsad: { type: "string" },
          foiz: { type: "integer" },
          baho: { type: "string" },
        },
        required: ["maqsad", "foiz", "baho"],
      },
    },
    motivatsiya: { type: "string" },
  },
  required: ["xulosa", "reja", "ogohlantirishlar", "progress", "motivatsiya"],
};

// Manual ("Hozir tahlil qil") va kechqurungi (evening) tahlil bir xil
// mazmunda: bugun nima bo'lgani + ERTANGI reja. Kechqurun 21:00 atrofida
// yuborilgani uchun bu tabiiy mos keladi.
const RETROSPECTIVE_INSTRUCTIONS = [
  "Quyidagi kontekst asosida kunlik tahlil tayyorla:",
  "1. xulosa — bugun nima bajarilgani/bajarilmagani haqida 2-4 gapli xulosa (A).",
  "2. reja — ertangi kun uchun vazifalar rejasi (B): ertangi band vaqtlar bilan to'qnashmaydigan taxminiy vaqt (HH:MM) tanla, muhimlik tartibida joylashtir. Ertaga rejalashtirilgan, muddati o'tgan va muddatsiz vazifalardan foydalanl.",
  "3. ogohlantirishlar — muddati o'tgan vazifalar yoki uzoq vaqt siljimagan maqsadlar bo'yicha ogohlantirishlar (C). Bo'lmasa bo'sh massiv.",
  "4. progress — har bir faol maqsad uchun foiz (foydalanuvchi kiritgan progress va bog'liq vazifalar holatidan kelib chiqib) va qisqa sur'at bahosi (D).",
  "5. motivatsiya — 1-2 gapli samimiy qo'llab-quvvatlovchi xabar (E).",
].join("\n");

// Ertalabki tahlil BOSHQACHA fokusga ega: kechagi emas, BUGUNGI kun haqida
// — kun endi boshlanayotgani uchun retrospektiv xulosa emas, qisqa salom +
// bugungi reja kerak. Xuddi shu ANALYSIS_SCHEMA maydonlaridan foydalanadi
// (yangi tur/komponent kerak emas — /ai sahifasi va Telegram formatlash
// ikkalasi ham bir xil AnalysisContent shaklini tushunadi), faqat
// ko'rsatmalar boshqacha.
const MORNING_INSTRUCTIONS = [
  "Quyidagi kontekst asosida ERTALABKI (kun boshlanishidagi) tahlil tayyorla:",
  "1. xulosa — bugungi kun uchun qisqa (1-2 gapli) samimiy tong salomi va umumiy holat (nechta vazifa bor, band vaqtlar bormi).",
  "2. reja — BUGUNGI kun uchun vazifalar rejasi (kechagi emas!): bugungi va muddati o'tgan vazifalardan, bugungi band vaqtlar bilan to'qnashmaydigan taxminiy vaqt (HH:MM) bilan, muhimlik tartibida joylashtir.",
  "3. ogohlantirishlar — muddati o'tgan vazifalar yoki uzoq vaqt siljimagan maqsadlar bo'yicha ogohlantirishlar. Bo'lmasa bo'sh massiv.",
  "4. progress — har bir faol maqsad uchun foiz va qisqa sur'at bahosi.",
  "5. motivatsiya — kunni boshlash uchun 1-2 gapli qisqa, quvvatlantiruvchi xabar.",
].join("\n");

export type AnalysisKind = "morning" | "evening" | "manual";

// `userId` egasiga tegishli AI kontekstini yig'ib, Gemini orqali tahlil
// yaratadi va `analyses` jadvaliga (`kind` bilan) saqlaydi.
export async function runAnalysisForUser(
  userId: string,
  kind: AnalysisKind
): Promise<AnalysisView> {
  const ctx = await buildAiContext(userId);
  const instructions = kind === "morning" ? MORNING_INSTRUCTIONS : RETROSPECTIVE_INSTRUCTIONS;

  const content = await generateJson<AnalysisContent>({
    system: SYSTEM_PROMPT,
    prompt: `${instructions}\n\n=== KONTEKST ===\n${formatContextForPrompt(ctx)}`,
    schema: ANALYSIS_SCHEMA,
  });

  const raw = JSON.stringify(content);
  const [row] = await db
    .insert(analyses)
    .values({ userId, kind, content: raw })
    .returning({
      id: analyses.id,
      kind: analyses.kind,
      createdAt: analyses.createdAt,
    });

  return {
    id: row.id,
    kind: row.kind,
    createdAtISO: row.createdAt.toISOString(),
    content: parseAnalysisContent(raw),
    raw,
  };
}
