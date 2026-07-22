// Guruhda AI Assistant: @mention, botga reply, yoki /ai /ask /chat
// buyruqlari orqali chaqiriladi. Mavjud umumiy AI Assistant (Bilim bazasi +
// System Prompt, src/lib/assistant.ts) qayta ishlatiladi — talabda aynan
// shu deyilgan ("Bot Knowledge Base va System Prompt asosida javob bersin").
// Har guruh uchun alohida kontekst (AI Memory) group_messages orqali
// saqlanadi (src/lib/group-moderation.ts).

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
