// AI Group Moderation (Anti-Spam): guruh xabarlarini deterministik
// (flood/caps/emoji/link/duplicate) va AI (reklama/so'kinish/toksiklik)
// belgilar bo'yicha tekshiradi, aniqlansa o'chirish/ogohlantirish/
// mute/ban bilan javob beradi. Har bir chaqiruv "Stage 1" ko'lamida —
// maxsus kalit so'z filtrlari, /purge va statistika admin-paneli Stage 2.

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { createHash } from "crypto";
import { Context } from "grammy";
import { db } from "@/db";
import {
  groupMessages,
  groupModerationLog,
  groupRecentMessages,
  groupSettings,
  groupWarnings,
} from "@/db/schema";
import { generateJson, type GeminiSchema } from "./gemini";

const FLOOD_WINDOW_SECONDS = 10;
const FLOOD_THRESHOLD = 5; // shu vaqt oralig'ida N ta xabar -> flood
const DUPLICATE_WINDOW_SECONDS = 120;
export const WARN_MUTE_THRESHOLD = 3; // shuncha ogohlantirishdan keyin mute
const MUTE_DURATION_SECONDS = 60 * 60; // 1 soat

export type ModerationVerdict = {
  action: "none" | "delete_warn" | "delete_mute" | "delete_ban";
  reason: string;
};

// ---------- Guruh sozlamalari ----------

export async function isAntispamEnabled(chatId: number): Promise<boolean> {
  const [row] = await db
    .select({ antispamEnabled: groupSettings.antispamEnabled })
    .from(groupSettings)
    .where(eq(groupSettings.chatId, BigInt(chatId)))
    .limit(1);
  // Yozuv hali yo'q bo'lsa (guruhda birinchi xabar) — standart holat: yoqilgan.
  return row?.antispamEnabled ?? true;
}

export async function setAntispamEnabled(chatId: number, enabled: boolean): Promise<void> {
  await db
    .insert(groupSettings)
    .values({ chatId: BigInt(chatId), antispamEnabled: enabled })
    .onConflictDoUpdate({
      target: groupSettings.chatId,
      set: { antispamEnabled: enabled, updatedAt: new Date() },
    });
}

// ---------- Deterministik (AI'siz) aniqlashlar ----------

const URL_PATTERN = /\bhttps?:\/\/\S+/gi;
const TELEGRAM_LINK_PATTERN = /\b(?:t\.me|telegram\.me)\/\S+/gi;
const USERNAME_PATTERN = /(?<![\w@])@[a-zA-Z0-9_]{4,}/g;
const BOT_USERNAME_PATTERN = /@[a-zA-Z0-9_]*bot\b/gi;

export function extractLinks(text: string): string[] {
  const matches = [
    ...(text.match(URL_PATTERN) ?? []),
    ...(text.match(TELEGRAM_LINK_PATTERN) ?? []),
  ];
  return [...new Set(matches)];
}

export function hasUsernameAd(text: string): boolean {
  const matches = text.match(USERNAME_PATTERN) ?? [];
  return matches.length >= 2; // bitta @mention normal, 2+ ko'pincha reklama
}

export function hasBotAd(text: string): boolean {
  return BOT_USERNAME_PATTERN.test(text);
}

// Katta harf (CAPS LOCK) spam: yetarlicha uzun matnda harflarning katta
// yozilgan ulushi juda yuqori bo'lsa.
export function isCapsLockSpam(text: string): boolean {
  const letters = text.replace(/[^a-zA-Zа-яА-ЯёЁ']/g, "");
  if (letters.length < 12) return false;
  const upper = letters.replace(/[^A-ZА-ЯЁ]/g, "");
  return upper.length / letters.length > 0.7;
}

// Emoji spam: matnda emoji sonini taxminiy hisoblaydi.
const EMOJI_PATTERN =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu;

export function isEmojiSpam(text: string): boolean {
  const emojiCount = (text.match(EMOJI_PATTERN) ?? []).length;
  return emojiCount >= 8;
}

function normalizeForHash(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function hashText(text: string): string {
  return createHash("sha256").update(normalizeForHash(text)).digest("hex");
}

// Guruhdagi xabarni flood/duplicate tekshiruvi uchun jurnalga yozadi va
// so'nggi xabarlar ro'yxatini qaytaradi (bitta so'rov ikkalasiga ham
// xizmat qiladi).
async function recordAndFetchRecent(
  chatId: number,
  telegramUserId: number,
  text: string
): Promise<{ textHash: string; createdAt: Date }[]> {
  const textHash = hashText(text);
  const windowStart = new Date(
    Date.now() - Math.max(FLOOD_WINDOW_SECONDS, DUPLICATE_WINDOW_SECONDS) * 1000
  );

  // MUHIM: insert va select ATAYLAB ketma-ket (parallel emas) — aks holda
  // hozirgi xabar select natijasida ko'rinmay qoladi va flood/duplicate
  // hisobi bir birlikka kam chiqadi (jonli testda aniqlangan haqiqiy xato).
  await db.insert(groupRecentMessages).values({
    chatId: BigInt(chatId),
    telegramUserId: BigInt(telegramUserId),
    textHash,
  });

  return db
    .select({ textHash: groupRecentMessages.textHash, createdAt: groupRecentMessages.createdAt })
    .from(groupRecentMessages)
    .where(
      and(
        eq(groupRecentMessages.chatId, BigInt(chatId)),
        eq(groupRecentMessages.telegramUserId, BigInt(telegramUserId)),
        gte(groupRecentMessages.createdAt, windowStart)
      )
    )
    .orderBy(desc(groupRecentMessages.createdAt))
    .limit(30);
}

export type DeterministicCheck = {
  isFlood: boolean;
  isDuplicate: boolean;
  isCapsSpam: boolean;
  isEmojiSpam: boolean;
  isUsernameAd: boolean;
  isBotAd: boolean;
  links: string[];
};

// Barcha deterministik (AI'siz) tekshiruvlarni bir yo'la bajaradi. Matn
// juda qisqa bo'lsa (masalan bitta so'z) flood/caps/emoji tekshiruvi
// ma'nosiz signal berishi mumkin, shuning uchun minimal uzunlik talab
// qilinadi.
export async function runDeterministicChecks(
  chatId: number,
  telegramUserId: number,
  text: string,
  isForwarded: boolean
): Promise<DeterministicCheck> {
  const recent = await recordAndFetchRecent(chatId, telegramUserId, text);
  const now = Date.now();

  const floodCount = recent.filter(
    (r) => now - r.createdAt.getTime() <= FLOOD_WINDOW_SECONDS * 1000
  ).length;
  const textHash = hashText(text);
  const duplicateCount = recent.filter(
    (r) =>
      r.textHash === textHash &&
      now - r.createdAt.getTime() <= DUPLICATE_WINDOW_SECONDS * 1000
  ).length;

  const links = extractLinks(text);

  return {
    isFlood: floodCount >= FLOOD_THRESHOLD,
    // duplicateCount includes the just-inserted row, shuning uchun >=2 talab qilinadi
    isDuplicate: duplicateCount >= 2,
    isCapsSpam: isCapsLockSpam(text),
    isEmojiSpam: isEmojiSpam(text),
    isUsernameAd: hasUsernameAd(text),
    isBotAd: hasBotAd(text) || isForwarded,
    links,
  };
}

// ---------- AI orqali reklama/so'kinish/toksiklik tahlili ----------

export type AiModerationResult = {
  isAd: boolean;
  isProfanity: boolean;
  riskLevel: "low" | "medium" | "high";
  categories: string[];
  reason: string;
};

const AI_MODERATION_SCHEMA: GeminiSchema = {
  type: "object",
  properties: {
    isAd: {
      type: "boolean",
      description:
        "Xabar reklama/spam ekanligi (pul ishlash taklifi, casino, betting, crypto signal, referral, reklama post). Oddiy foydali havola yoki tabiiy suhbat EMAS.",
    },
    isProfanity: {
      type: "boolean",
      description:
        "O'zbek, rus yoki ingliz tilida haqorat, so'kinish, toxic gap yoki tahdid borligi.",
    },
    riskLevel: {
      type: "string",
      enum: ["low", "medium", "high"],
      description: "Umumiy xavf darajasi",
    },
    categories: {
      type: "array",
      items: { type: "string" },
      description:
        "Aniqlangan toifalar (mos kelganlari): Toxicity, Hate Speech, Harassment, Threat, Violence, Adult Content, Scam, Fraud, Phishing, Illegal Content",
    },
    reason: { type: "string", description: "Qisqacha sabab, o'zbek tilida" },
  },
  required: ["isAd", "isProfanity", "riskLevel", "categories", "reason"],
};

export async function analyzeGroupMessage(
  text: string,
  links: string[]
): Promise<AiModerationResult> {
  const prompt = [
    "Sen Telegram guruhi uchun moderatsiya AI'sisan. Quyidagi xabarni tahlil qil.",
    "",
    "Tekshirish kerak bo'lgan narsalar:",
    "- Reklama/spam: pul ishlash taklifi, casino, betting, crypto signal, referral, reklama post. Oddiy foydali havolani (masalan yangilik, texnik hujjat) reklamadan farqla.",
    "- So'kinish/haqorat/tahdid/nafrat nutqi — o'zbek, rus yoki ingliz tilida.",
    "- Umumiy zararli mazmun: Toxicity, Hate Speech, Harassment, Threat, Violence, Adult Content, Scam, Fraud, Phishing, Illegal Content.",
    "",
    "riskLevel'ni xolisona belgila: 'high' faqat aniq va jiddiy holatlarda (tahdid, nafrat nutqi, scam/phishing, kattalar uchun kontent, noqonuniy taklif). Oddiy salbiy fikr yoki tanqid 'low' yoki 'medium'.",
    "",
    `=== XABAR MATNI ===\n${text}`,
    "",
    `=== XABARDAGI HAVOLALAR ===\n${links.length > 0 ? links.join("\n") : "(yo'q)"}`,
  ].join("\n");

  return generateJson<AiModerationResult>({
    prompt,
    schema: AI_MODERATION_SCHEMA,
    temperature: 0.2,
  });
}

// ---------- Ijro (delete/warn/mute/ban) ----------

export async function isGroupAdmin(ctx: Context): Promise<boolean> {
  const chatId = ctx.chat?.id;
  const userId = ctx.from?.id;
  if (!chatId || !userId) return false;
  try {
    const member = await ctx.api.getChatMember(chatId, userId);
    return member.status === "creator" || member.status === "administrator";
  } catch (error) {
    console.error("[group-moderation] admin tekshiruvida xato", error);
    return false;
  }
}

// Foydalanuvchining ogohlantirish sonini oshiradi (yozuv yo'q bo'lsa 1 bilan
// yaratadi) va yangi qiymatni bitta so'rovda qaytaradi.
export async function warnUser(chatId: number, telegramUserId: number): Promise<number> {
  const [row] = await db
    .insert(groupWarnings)
    .values({ chatId: BigInt(chatId), telegramUserId: BigInt(telegramUserId), count: 1 })
    .onConflictDoUpdate({
      target: [groupWarnings.chatId, groupWarnings.telegramUserId],
      set: { count: sql`${groupWarnings.count} + 1`, updatedAt: new Date() },
    })
    .returning({ count: groupWarnings.count });
  return row?.count ?? 1;
}

export async function resetWarnings(chatId: number, telegramUserId: number): Promise<void> {
  await db
    .delete(groupWarnings)
    .where(
      and(
        eq(groupWarnings.chatId, BigInt(chatId)),
        eq(groupWarnings.telegramUserId, BigInt(telegramUserId))
      )
    );
}

export async function logModerationAction(
  chatId: number,
  telegramUserId: number | null,
  telegramUsername: string | null,
  action: "deleted" | "warned" | "muted" | "banned",
  reason: string,
  messageText: string | null
): Promise<void> {
  await db.insert(groupModerationLog).values({
    chatId: BigInt(chatId),
    telegramUserId: telegramUserId !== null ? BigInt(telegramUserId) : null,
    telegramUsername,
    action,
    reason,
    messageText: messageText?.slice(0, 2000) ?? null,
  });
}

export async function muteUser(
  ctx: Context,
  chatId: number,
  telegramUserId: number,
  durationSeconds = MUTE_DURATION_SECONDS
): Promise<void> {
  await ctx.api.restrictChatMember(
    chatId,
    telegramUserId,
    { can_send_messages: false },
    { until_date: Math.floor(Date.now() / 1000) + durationSeconds }
  );
}

export async function unmuteUser(ctx: Context, chatId: number, telegramUserId: number): Promise<void> {
  await ctx.api.restrictChatMember(chatId, telegramUserId, {
    can_send_messages: true,
    can_send_audios: true,
    can_send_documents: true,
    can_send_photos: true,
    can_send_videos: true,
    can_send_video_notes: true,
    can_send_voice_notes: true,
    can_send_polls: true,
    can_send_other_messages: true,
    can_add_web_page_previews: true,
  });
}

export async function banUser(ctx: Context, chatId: number, telegramUserId: number): Promise<void> {
  await ctx.api.banChatMember(chatId, telegramUserId);
}

export async function unbanUser(ctx: Context, chatId: number, telegramUserId: number): Promise<void> {
  await ctx.api.unbanChatMember(chatId, telegramUserId, { only_if_banned: true });
}

// Kick — Telegram'da alohida metod yo'q: ban + darhol unban (foydalanuvchi
// guruhdan chiqariladi, lekin taklif havolasi orqali qayta qo'shilishi mumkin).
export async function kickUser(ctx: Context, chatId: number, telegramUserId: number): Promise<void> {
  await ctx.api.banChatMember(chatId, telegramUserId);
  await ctx.api.unbanChatMember(chatId, telegramUserId, { only_if_banned: true });
}

// Xabar spam/toksik deb topilganda: o'chirish + ogohlantirish, ogohlantirish
// chegarasiga yetganda mute'ga eskalatsiya qiladi. AI "high" xavf desa,
// ogohlantirish sonidan qat'i nazar darhol mute qilinadi (talabga mos:
// "High bo'lsa: Delete + Mute").
export async function enforceViolation(
  ctx: Context,
  chatId: number,
  telegramUserId: number,
  username: string | null,
  reason: string,
  messageText: string,
  forceMute: boolean
): Promise<ModerationVerdict> {
  try {
    await ctx.deleteMessage();
  } catch (error) {
    console.error("[group-moderation] xabarni o'chirishda xato", error);
  }
  await logModerationAction(chatId, telegramUserId, username, "deleted", reason, messageText);

  if (forceMute) {
    await muteUser(ctx, chatId, telegramUserId);
    await logModerationAction(chatId, telegramUserId, username, "muted", reason, null);
    return { action: "delete_mute", reason };
  }

  const count = await warnUser(chatId, telegramUserId);
  await logModerationAction(chatId, telegramUserId, username, "warned", reason, null);

  if (count >= WARN_MUTE_THRESHOLD) {
    await muteUser(ctx, chatId, telegramUserId);
    await resetWarnings(chatId, telegramUserId);
    await logModerationAction(chatId, telegramUserId, username, "muted", reason, null);
    return { action: "delete_mute", reason };
  }

  return { action: "delete_warn", reason };
}

// ---------- Guruh AI Assistant xotira (memory) ----------

export async function saveGroupConversation(
  ownerId: string,
  chatId: number,
  fromName: string | null,
  fromUsername: string | null,
  question: string,
  answer: string
): Promise<void> {
  await db.insert(groupMessages).values({
    userId: ownerId,
    chatId: BigInt(chatId),
    fromName,
    fromUsername,
    question,
    answer,
  });
}

export async function getGroupConversationHistory(
  chatId: number,
  limit = 6
): Promise<{ question: string; answer: string }[]> {
  const rows = await db
    .select({ question: groupMessages.question, answer: groupMessages.answer })
    .from(groupMessages)
    .where(eq(groupMessages.chatId, BigInt(chatId)))
    .orderBy(desc(groupMessages.createdAt))
    .limit(limit);
  return rows.reverse();
}
