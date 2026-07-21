// AI Assistant orchestration — System Prompt + Bilim bazasi kontekstini
// birlashtirib Gemini'ga yuboradi. userId to'g'ridan-to'g'ri parametr sifatida
// qabul qilinadi (session/cookie'ga bog'liq emas), chunki bu funksiya Telegram
// bot handleridan ham chaqiriladi — u yerda Next.js so'rov konteksti yo'q.

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeEntries, users } from "@/db/schema";
import { generateText } from "./gemini";
import { DEFAULT_ASSISTANT_SYSTEM_PROMPT } from "./assistant-prompt";

export type ConversationTurn = { question: string; answer: string };

function formatKnowledgeBase(
  entries: { title: string; content: string }[]
): string {
  if (entries.length === 0) return "(bilim bazasi hali bo'sh)";
  return entries
    .map((e) => `### ${e.title}\n${e.content}`)
    .join("\n\n");
}

function formatHistory(history: ConversationTurn[]): string {
  if (history.length === 0) return "(oldingi suhbat yo'q)";
  return history
    .map((t) => `Foydalanuvchi: ${t.question}\nSen: ${t.answer}`)
    .join("\n\n");
}

// `history` — shu suhbatdoshning oldingi savol-javoblari (eng eskisidan
// yangisiga), suhbat davomiyligini ta'minlash uchun promptga qo'shiladi.
// Bo'sh massiv — kontekstsiz, bir martalik savol (masalan veb-chat).
// `senderName` — suhbatdoshning ismi (Telegram'dan), berilsa AI javobida
// tabiiy ravishda undan foydalanadi (masalan salomlashishda ismini aytadi).
export async function answerAssistantQuestion(
  userId: string,
  question: string,
  history: ConversationTurn[] = [],
  senderName?: string | null
): Promise<string> {
  const [[user], entries] = await Promise.all([
    db
      .select({ assistantSystemPrompt: users.assistantSystemPrompt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    db
      .select({ title: knowledgeEntries.title, content: knowledgeEntries.content })
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.userId, userId))
      .orderBy(desc(knowledgeEntries.updatedAt)),
  ]);

  const systemPrompt =
    user?.assistantSystemPrompt?.trim() || DEFAULT_ASSISTANT_SYSTEM_PROMPT;

  const prompt = [
    "=== BILIM BAZASI ===",
    formatKnowledgeBase(entries),
    "",
    "=== OLDINGI SUHBAT ===",
    formatHistory(history),
    "",
    senderName ? `=== SUHBATDOSH ===\nIsmi: ${senderName}. Javobingda tabiiy ravishda ismidan foydalan (masalan salomlashishda), lekin har gapda majburiy takrorlama.\n` : "",
    "=== FOYDALANUVCHI SAVOLI ===",
    question,
  ].join("\n");

  return generateText({ system: systemPrompt, prompt, temperature: 0.5 });
}
