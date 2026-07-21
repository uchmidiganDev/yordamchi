// Begona (loyiha egasi bo'lmagan) foydalanuvchilarga helperizim_bot orqali
// AI Assistant javobini yozadigan yordamchi. Yoqilgan/o'chirilganligi
// /telegram sahifasidagi botlardan kamida bittasi yoqilganmi degan holatga
// bog'liq — alohida sozlama emas, chunki helperizim_bot o'zi telegram_bots
// jadvaliga kirmaydi (u shaxsiy, chek/AI Assistant funksiyalariga ega).

import { Context } from "grammy";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { telegramBots, users } from "@/db/schema";
import { answerAssistantQuestion } from "./assistant";

const OWNER_TELEGRAM_ID = process.env.ALLOWED_TELEGRAM_ID;
if (!OWNER_TELEGRAM_ID) {
  throw new Error("ALLOWED_TELEGRAM_ID topilmadi (.env.local ni tekshiring)");
}

export async function replyAsPublicAssistant(ctx: Context, text: string) {
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.telegramId, BigInt(OWNER_TELEGRAM_ID as string)))
    .limit(1);
  if (!owner) return;

  const [enabledBot] = await db
    .select({ id: telegramBots.id })
    .from(telegramBots)
    .where(and(eq(telegramBots.userId, owner.id), eq(telegramBots.enabled, true)))
    .limit(1);

  if (!enabledBot) {
    await ctx.reply("Hozircha javob bermayapti. Birozdan so'ng qayta urinib ko'ring.");
    return;
  }

  const senderName =
    [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(" ") ||
    ctx.from?.username ||
    null;

  try {
    await ctx.replyWithChatAction("typing");
    const answer = await answerAssistantQuestion(owner.id, text, [], senderName);
    await ctx.reply(answer);
  } catch (error) {
    console.error("[public-reply] AI Assistant xatosi", error);
    await ctx.reply("Javob berishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
  }
}
