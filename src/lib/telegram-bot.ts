import { Bot } from "grammy";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, loginTokens } from "@/db/schema";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN topilmadi (.env.local ni tekshiring)");
}

const ALLOWED_TELEGRAM_ID = process.env.ALLOWED_TELEGRAM_ID;
if (!ALLOWED_TELEGRAM_ID) {
  throw new Error(
    "ALLOWED_TELEGRAM_ID topilmadi (.env.local ni tekshiring)"
  );
}

export const bot = new Bot(token);

bot.command("start", async (ctx) => {
  const fromId = ctx.from?.id;
  if (!fromId) return;

  // Faqat loyiha egasining Telegram ID'siga ruxsat beriladi.
  if (fromId.toString() !== ALLOWED_TELEGRAM_ID) {
    await ctx.reply(
      "Kechirasiz, bu ilova shaxsiy foydalanish uchun mo'ljallangan va sizga kirish huquqi berilmagan."
    );
    return;
  }

  const payload = ctx.match?.toString().trim();

  if (!payload) {
    await ctx.reply(
      "Salom! Ilovaga kirish uchun ilovadagi \"Telegram orqali kirish\" tugmasini bosing."
    );
    return;
  }

  const [loginToken] = await db
    .select()
    .from(loginTokens)
    .where(
      and(eq(loginTokens.token, payload), eq(loginTokens.status, "pending"))
    )
    .limit(1);

  if (!loginToken || loginToken.expiresAt.getTime() < Date.now()) {
    await ctx.reply(
      "Havola eskirgan yoki noto'g'ri. Ilovada qaytadan urinib ko'ring."
    );
    return;
  }

  const telegramIdBig = BigInt(fromId);

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramIdBig))
    .limit(1);

  const user =
    existingUser ??
    (
      await db
        .insert(users)
        .values({
          telegramId: telegramIdBig,
          telegramUsername: ctx.from?.username,
          name: ctx.from?.first_name,
        })
        .returning()
    )[0];

  await db
    .update(loginTokens)
    .set({ status: "confirmed", telegramId: telegramIdBig, userId: user.id })
    .where(eq(loginTokens.token, payload));

  await ctx.reply("✅ Muvaffaqiyatli tasdiqlandi! Ilovaga qaytishingiz mumkin.");
});
