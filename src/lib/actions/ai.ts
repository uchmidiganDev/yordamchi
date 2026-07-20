"use server";

// AI server action'lari — Sprint 3: Gemini orqali kunlik tahlil (A–E),
// maqsadni vazifalarga bo'lish (F) va tahlil tarixi (E7). Kutilgan xatolar
// (API kaliti yo'q, Gemini xatosi) throw o'rniga { ok: false } bilan
// qaytariladi — production'da server action xatolari qisqartirilib
// yuborilishining oldini olish uchun.

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { analyses, goals, tasks } from "@/db/schema";
import { buildAiContext, formatContextForPrompt } from "@/lib/ai-context";
import {
  parseAnalysisContent,
  type AnalysisContent,
  type AnalysisView,
} from "@/lib/analysis";
import { generateJson } from "@/lib/gemini";
import { requireUserId } from "./require-user";

const SYSTEM_PROMPT = [
  "Sen \"Maqsadlarim\" ilovasining shaxsiy AI yordamchisisan.",
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

const ANALYSIS_INSTRUCTIONS = [
  "Quyidagi kontekst asosida kunlik tahlil tayyorla:",
  "1. xulosa — bugun nima bajarilgani/bajarilmagani haqida 2-4 gapli xulosa (A).",
  "2. reja — ertangi kun uchun vazifalar rejasi (B): ertangi band vaqtlar bilan to'qnashmaydigan taxminiy vaqt (HH:MM) tanla, muhimlik tartibida joylashtir. Ertaga rejalashtirilgan, muddati o'tgan va muddatsiz vazifalardan foydalanl.",
  "3. ogohlantirishlar — muddati o'tgan vazifalar yoki uzoq vaqt siljimagan maqsadlar bo'yicha ogohlantirishlar (C). Bo'lmasa bo'sh massiv.",
  "4. progress — har bir faol maqsad uchun foiz (foydalanuvchi kiritgan progress va bog'liq vazifalar holatidan kelib chiqib) va qisqa sur'at bahosi (D).",
  "5. motivatsiya — 1-2 gapli samimiy qo'llab-quvvatlovchi xabar (E).",
].join("\n");

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Noma'lum xatolik yuz berdi";
}

// "Hozir tahlil qil" tugmasi — A–E funksiyalarni bitta strukturaviy chaqiruvda
// bajarib, natijani `analyses` jadvaliga saqlaydi.
export async function runManualAnalysis(): Promise<ActionResult<AnalysisView>> {
  const userId = await requireUserId();

  try {
    const ctx = await buildAiContext(userId);
    const content = await generateJson<AnalysisContent>({
      system: SYSTEM_PROMPT,
      prompt: `${ANALYSIS_INSTRUCTIONS}\n\n=== KONTEKST ===\n${formatContextForPrompt(ctx)}`,
      schema: ANALYSIS_SCHEMA,
    });

    const raw = JSON.stringify(content);
    const [row] = await db
      .insert(analyses)
      .values({ userId, kind: "manual", content: raw })
      .returning({
        id: analyses.id,
        kind: analyses.kind,
        createdAt: analyses.createdAt,
      });

    revalidatePath("/ai");

    return {
      ok: true,
      data: {
        id: row.id,
        kind: row.kind,
        createdAtISO: row.createdAt.toISOString(),
        content: parseAnalysisContent(raw),
        raw,
      },
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

// Tahlil tarixi (E7) — oxirgi tahlillar ro'yxati.
export async function listAnalyses(): Promise<AnalysisView[]> {
  const userId = await requireUserId();
  const rows = await db
    .select()
    .from(analyses)
    .where(eq(analyses.userId, userId))
    .orderBy(desc(analyses.createdAt))
    .limit(30);

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    createdAtISO: r.createdAt.toISOString(),
    content: parseAnalysisContent(r.content),
    raw: r.content,
  }));
}

export type SuggestedTask = { title: string; priority: "high" | "mid" | "low" };

const SUGGEST_SCHEMA = {
  type: "object",
  properties: {
    vazifalar: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          priority: { type: "string", enum: ["high", "mid", "low"] },
        },
        required: ["title", "priority"],
      },
    },
  },
  required: ["vazifalar"],
};

// "AI bilan bo'lish" (F) — katta maqsadni kichik, aniq vazifalarga ajratish
// taklifini qaytaradi. Foydalanuvchi tasdiqlagach addGoalTasks() qo'shadi.
export async function suggestGoalTasks(
  goalId: string
): Promise<ActionResult<SuggestedTask[]>> {
  const userId = await requireUserId();

  const [goal] = await db
    .select()
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1);
  if (!goal) return { ok: false, error: "Maqsad topilmadi" };

  const existing = await db
    .select({ title: tasks.title })
    .from(tasks)
    .where(and(eq(tasks.goalId, goalId), eq(tasks.userId, userId)));

  const existingText =
    existing.length === 0
      ? "(hali vazifa yo'q)"
      : existing.map((t) => `- ${t.title}`).join("\n");

  try {
    const result = await generateJson<{ vazifalar: SuggestedTask[] }>({
      system: SYSTEM_PROMPT,
      prompt: [
        "Quyidagi maqsadni 4-8 ta kichik, aniq va bajarsa bo'ladigan vazifaga ajrat.",
        "Har bir vazifa qisqa sarlavha (title) va muhimlik (priority: high/mid/low) bilan bo'lsin.",
        "Mavjud vazifalarni takrorlama.",
        "",
        `MAQSAD: ${goal.title}`,
        goal.description ? `TAVSIF: ${goal.description}` : "",
        `PROGRESS: ${goal.progress}%`,
        "",
        "MAVJUD BOG'LIQ VAZIFALAR:",
        existingText,
      ]
        .filter(Boolean)
        .join("\n"),
      schema: SUGGEST_SCHEMA,
      temperature: 0.6,
    });

    const valid = (result.vazifalar ?? [])
      .filter(
        (t) =>
          t &&
          typeof t.title === "string" &&
          t.title.trim() &&
          ["high", "mid", "low"].includes(t.priority)
      )
      .slice(0, 10)
      .map((t) => ({ title: t.title.trim(), priority: t.priority }));

    if (valid.length === 0) {
      return { ok: false, error: "AI vazifa taklif qila olmadi. Qaytadan urinib ko'ring." };
    }
    return { ok: true, data: valid };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

// F funksiyasining tasdiqlash bosqichi — tanlangan takliflarni maqsadga
// bog'langan vazifalar sifatida saqlaydi.
export async function addGoalTasks(
  goalId: string,
  items: SuggestedTask[]
): Promise<ActionResult<number>> {
  const userId = await requireUserId();

  const [goal] = await db
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1);
  if (!goal) return { ok: false, error: "Maqsad topilmadi" };

  const valid = items
    .filter(
      (t) =>
        t &&
        typeof t.title === "string" &&
        t.title.trim() &&
        ["high", "mid", "low"].includes(t.priority)
    )
    .slice(0, 10);
  if (valid.length === 0) {
    return { ok: false, error: "Qo'shish uchun vazifa tanlanmagan" };
  }

  await db.insert(tasks).values(
    valid.map((t) => ({
      userId,
      goalId,
      title: t.title.trim(),
      priority: t.priority,
    }))
  );

  revalidatePath("/");
  revalidatePath("/tasks");

  return { ok: true, data: valid.length };
}
