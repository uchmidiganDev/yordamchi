// "/tel" AI telefon operatori uchun orkestratsiya qatlami: system prompt
// qurish (Bilim baza + qattiq grounding), ElevenLabs agentini
// yaratish/yangilash, post-call webhook payload'idan chaqiruvchi raqamni
// ajratib olishga urinish va qo'ng'iroq audio yozuvini fonda yuklab olish.

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { knowledgeEntries, phoneCalls, users } from "@/db/schema";
import { formatKnowledgeBase } from "./assistant";
import {
  createPhoneAgent,
  getConversationAudio,
  updatePhoneAgent,
} from "./elevenlabs";
import {
  DEFAULT_PHONE_FIRST_MESSAGE,
  PHONE_AGENT_SYSTEM_PROMPT_HEADER,
} from "./phone-agent-prompt";

export async function buildPhoneSystemPrompt(userId: string): Promise<string> {
  const entries = await db
    .select({ title: knowledgeEntries.title, content: knowledgeEntries.content })
    .from(knowledgeEntries)
    .where(eq(knowledgeEntries.userId, userId))
    .orderBy(desc(knowledgeEntries.updatedAt));

  return [
    PHONE_AGENT_SYSTEM_PROMPT_HEADER,
    "",
    "=== BILIM BAZASI ===",
    formatKnowledgeBase(entries),
  ].join("\n");
}

// Agent yo'q bo'lsa yaratadi (DB'ga `phoneAgentId` yozadi), bor bo'lsa
// system prompt/ovozni yangilaydi. "/tel" sahifasidagi "Sinxronlash"
// tugmasi va Yoqish/O'chirish svitchi (agent hali yo'q bo'lsa) shu orqali
// ishlaydi.
export async function syncPhoneAgent(userId: string): Promise<string> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) {
    throw new Error("ELEVENLABS_VOICE_ID topilmadi (.env.local ni tekshiring)");
  }

  const [user] = await db
    .select({ phoneAgentId: users.phoneAgentId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const systemPrompt = await buildPhoneSystemPrompt(userId);
  const params = { systemPrompt, firstMessage: DEFAULT_PHONE_FIRST_MESSAGE, voiceId };

  if (user?.phoneAgentId) {
    await updatePhoneAgent(user.phoneAgentId, params);
    return user.phoneAgentId;
  }

  const agentId = await createPhoneAgent(params);
  await db.update(users).set({ phoneAgentId: agentId }).where(eq(users.id, userId));
  return agentId;
}

function readPath(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

// ElevenLabs hujjatlarida chaqiruvchi telefon raqami maydonining aniq
// joylashuvi tasdiqlanmagan (ba'zi manbalar "webhook'da yo'q" deydi, SIP
// trunking hujjati esa "caller_id dynamic variable sifatida mavjud" deydi)
// — shu sabab bir nechta ehtimoliy yo'l qidiriladi. Hech biri topilmasa
// `null` qaytadi; xom JSON baribir `rawPayload`ga saqlanadi (2026-07-31
// qarori), shuning uchun jonli sinovdan keyin bu funksiyani tuzatish
// tarixiy ma'lumotni yo'qotmaydi.
export function parseCallerNumber(data: Record<string, unknown>): string | null {
  const candidates = [
    ["metadata", "phone_call", "external_number"],
    ["metadata", "phone_call", "caller_number"],
    ["metadata", "caller_id"],
    ["conversation_initiation_client_data", "dynamic_variables", "system__caller_id"],
    ["conversation_initiation_client_data", "dynamic_variables", "caller_id"],
  ];
  for (const path of candidates) {
    const value = readPath(data, path);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function parseCalleeNumber(data: Record<string, unknown>): string | null {
  const candidates = [
    ["metadata", "phone_call", "agent_number"],
    ["conversation_initiation_client_data", "dynamic_variables", "system__called_number"],
  ];
  for (const path of candidates) {
    const value = readPath(data, path);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

// Qo'ng'iroq tugagach audio yozuvni fonda (Next.js `after()`) yuklab olib
// DB'ga saqlaydi. Best-effort — xato bo'lsa faqat log qilinadi, chaqiruv
// yozuvining o'zi (transkript/vaqt/raqam) allaqachon saqlangan bo'ladi
// (Google Calendar sinxron naqshiga mos, 2026-07-20 qarori).
export async function fetchAndStoreCallRecording(conversationId: string): Promise<void> {
  try {
    const { buffer, mimeType } = await getConversationAudio(conversationId);
    await db
      .update(phoneCalls)
      .set({ recordingBase64: buffer.toString("base64"), recordingMimeType: mimeType })
      .where(eq(phoneCalls.conversationId, conversationId));
  } catch (err) {
    console.error("[phone-agent] audio yozuvni olishda xato", conversationId, err);
  }
}
