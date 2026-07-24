// Guruhda AI Assistant: @mention, botga reply, yoki /ai /ask /chat
// buyruqlari orqali chaqiriladi. Mavjud umumiy AI Assistant (Bilim bazasi +
// System Prompt, src/lib/assistant.ts) qayta ishlatiladi — talabda aynan
// shu deyilgan ("Bot Knowledge Base va System Prompt asosida javob bersin").
// Har guruh uchun alohida kontekst (AI Memory) group_messages orqali
// saqlanadi (src/lib/group-moderation.ts).
//
// Shuningdek, guruh a'zolari egaga (ilova egasi) to'g'ridan-to'g'ri yozganda
// ham (uning @username'ini mention qilib yoki uning xabariga reply qilib)
// bot egasining O'RNIGA AI javob beradi — extractOwnerDirectedQuestion().
// Bu ham xuddi shu answerAssistantQuestion()/answerInGroup() infratuzilmasini
// qayta ishlatadi, chunki maqsad bir xil: egasining bilim bazasi/System
// Prompt asosida "u kabi" javob berish (Telegram Business orqali shaxsiy
// chatda ishlaydigan mexanizmning guruhga kengaytmasi).

import { Context } from "grammy";
import { answerAssistantQuestion } from "./assistant";
import { getGroupConversationHistory, saveGroupConversation } from "./group-moderation";

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;

// Xabar guruh AI Assistant'ini chaqirayotganini aniqlaydi va savol matnini
// ajratib beradi. Uch holat: @mention, botga reply, yoki /ai|/ask|/chat
// buyruq (buyruq matni alohida chaqiriladi, bu yerda faqat mention/reply).
export function extractMentionQuestion(ctx: Context): string | null {
  const text = ctx.message?.text;
  if (!text || !BOT_USERNAME) return null;

  const mentionTag = `@${BOT_USERNAME}`;
  if (text.includes(mentionTag)) {
    return text.replace(new RegExp(mentionTag, "gi"), "").trim() || null;
  }

  const repliedTo = ctx.message?.reply_to_message;
  if (repliedTo?.from?.is_bot && repliedTo.from.username?.toLowerCase() === BOT_USERNAME.toLowerCase()) {
    return text.trim() || null;
  }

  return null;
}

// Guruhda kimdir egaga to'g'ridan-to'g'ri yozganini aniqlaydi: eganing
// @username'ini mention qilgan YOKI eganing avvalgi xabariga reply qilgan.
// Ega o'zi yozgan (yoki o'zining xabariga reply qilgan) xabarlarni bu funksiya
// ATAYLAB e'tiborsiz qoldiradi — bu faqat BOSHQALAR ega bilan gaplashmoqchi
// bo'lganda ishga tushishi kerak.
export function extractOwnerDirectedQuestion(
  ctx: Context,
  ownerTelegramId: number,
  ownerUsername: string | null
): string | null {
  const text = ctx.message?.text;
  const fromId = ctx.from?.id;
  if (!text || !fromId || fromId === ownerTelegramId) return null;

  if (ownerUsername) {
    const mentionTag = `@${ownerUsername}`;
    if (text.toLowerCase().includes(mentionTag.toLowerCase())) {
      return text.replace(new RegExp(mentionTag, "gi"), "").trim() || null;
    }
  }

  const repliedTo = ctx.message?.reply_to_message;
  if (repliedTo?.from?.id === ownerTelegramId && !repliedTo.from.is_bot) {
    return text.trim() || null;
  }

  return null;
}

export async function answerInGroup(
  ctx: Context,
  ownerId: string,
  question: string
): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const senderName =
    [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ") ||
    ctx.from?.username ||
    null;

  try {
    await ctx.replyWithChatAction("typing");
    const history = await getGroupConversationHistory(chatId);
    const answer = await answerAssistantQuestion(ownerId, question, history, senderName);
    await ctx.reply(answer, { reply_parameters: { message_id: ctx.message!.message_id } });
    await saveGroupConversation(
      ownerId,
      chatId,
      senderName,
      ctx.from?.username ?? null,
      question,
      answer
    );
  } catch (error) {
    console.error("[group-assistant] javob berishda xato", error);
    await ctx.reply("Kechirasiz, javob berishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
  }
}
