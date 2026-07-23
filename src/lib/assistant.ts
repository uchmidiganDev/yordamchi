// AI Assistant orchestration — System Prompt + Bilim bazasi kontekstini
// birlashtirib Gemini'ga yuboradi. userId to'g'ridan-to'g'ri parametr sifatida
// qabul qilinadi (session/cookie'ga bog'liq emas), chunki bu funksiya Telegram
// bot handleridan ham chaqiriladi — u yerda Next.js so'rov konteksti yo'q.

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeEntries, users } from "@/db/schema";
import { generateJson, generateText } from "./gemini";
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

async function buildAssistantContext(
  userId: string,
  history: ConversationTurn[],
  senderName?: string | null
): Promise<{ systemPrompt: string; contextBlock: string }> {
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

  const contextBlock = [
    "=== BILIM BAZASI ===",
    formatKnowledgeBase(entries),
    "",
    "=== OLDINGI SUHBAT ===",
    formatHistory(history),
    "",
    senderName ? `=== SUHBATDOSH ===\nIsmi: ${senderName}. Javobingda tabiiy ravishda ismidan foydalan (masalan salomlashishda), lekin har gapda majburiy takrorlama.\n` : "",
  ].join("\n");

  return { systemPrompt, contextBlock };
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
  const { systemPrompt, contextBlock } = await buildAssistantContext(userId, history, senderName);

  const prompt = [contextBlock, "=== FOYDALANUVCHI SAVOLI ===", question].join("\n");

  return generateText({ system: systemPrompt, prompt, temperature: 0.5 });
}

export type GuestReply = { answer: string; ownerTask: string | null };

// `answerAssistantQuestion()`ga o'xshash, lekin FAQAT egasi bo'lmagan
// (mehmon/mijoz) suhbatdoshlar uchun ishlatiladi — ular ilova egasiga
// ("Bilim bazasi"da tasvirlangan shaxsga) mo'ljallangan aniq topshiriq/eslatma
// qoldirishi mumkin (masalan "unga ayt, uyga kelishdan oldin non olib
// kelsin"). Shu holatni bitta Gemini chaqiruvida (javob bilan birga)
// aniqlaydi — alohida ikkinchi chaqiruv qilib xarajat/kechikishni
// oshirmaslik uchun (2026-07-20'dagi A-E birlashtirish qaroriga mos yondashuv).
export async function answerGuestQuestion(
  userId: string,
  question: string,
  history: ConversationTurn[] = [],
  senderName?: string | null
): Promise<GuestReply> {
  const { systemPrompt, contextBlock } = await buildAssistantContext(userId, history, senderName);

  const prompt = [
    contextBlock,
    "=== FOYDALANUVCHI SAVOLI ===",
    question,
    "",
    "=== QO'SHIMCHA VAZIFA ===",
    'Yuqoridagi savolda ilova egasiga (Bilim bazasi/System Promptda tasvirlangan shaxsga) mo\'ljallangan ANIQ topshiriq, eslatma yoki xabar bo\'lsa (masalan "unga ayt...", "eslatib qo\'y...", "kelganda ... qilsin", "unutmasin..." kabi iboralar bilan), "ownerTask" maydoniga shu topshiriqni QISQA va ANIQ (buyruq shaklida, masalan "Uyga kelishdan oldin non olib kelish") yoz. Agar bunday aniq topshiriq/eslatma bo\'lmasa (oddiy savol-javob bo\'lsa), "ownerTask" maydonini bo\'sh qatorga ("") qoldir.',
  ].join("\n");

  const raw = await generateJson<{ answer: string; ownerTask: string }>({
    system: systemPrompt,
    prompt,
    schema: {
      type: "object",
      properties: {
        answer: { type: "string" },
        ownerTask: { type: "string" },
      },
      required: ["answer", "ownerTask"],
    },
    temperature: 0.5,
  });

  return { answer: raw.answer, ownerTask: raw.ownerTask.trim() || null };
}
