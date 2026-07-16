import { Bot, Context } from "grammy";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, loginTokens } from "@/db/schema";
import { parsePaynetReceipt } from "./paynet-receipt";
import { saveReceiptExpense } from "./expense-from-receipt";
import { extractPdfText } from "./pdf-text";

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
  console.log("[telegram-bot] /start olindi", {
    fromId,
    match: ctx.match,
    allowedId: ALLOWED_TELEGRAM_ID,
  });
  if (!fromId) return;

  // Faqat loyiha egasining Telegram ID'siga ruxsat beriladi.
  if (fromId.toString() !== ALLOWED_TELEGRAM_ID) {
    console.log("[telegram-bot] rad etildi: ID mos kelmadi", {
      fromId: fromId.toString(),
      allowedId: ALLOWED_TELEGRAM_ID,
    });
    await ctx.reply(
      "Kechirasiz, bu ilova shaxsiy foydalanish uchun mo'ljallangan va sizga kirish huquqi berilmagan."
    );
    return;
  }

  const payload = ctx.match?.toString().trim();

  if (!payload) {
    console.log("[telegram-bot] payload yo'q (oddiy /start)");
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

  console.log("[telegram-bot] token qidiruvi", {
    payload,
    found: !!loginToken,
    expiresAt: loginToken?.expiresAt,
  });

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

// Chek matnini parse qilib, foydalanuvchining xarajatiga saqlaydi va natijani
// javob sifatida yuboradi. Matn ham, PDF'dan ajratilgan matn ham shu funksiyaga
// beriladi. `silentIfNotReceipt` — matn xabarlar uchun true (chek bo'lmasa jim
// turamiz), PDF uchun false (foydalanuvchiga xatolikni aytamiz).
async function handleReceiptText(
  ctx: Context,
  text: string,
  fromId: number,
  silentIfNotReceipt: boolean
) {
  const receipt = parsePaynetReceipt(text);
  if (!receipt) {
    if (!silentIfNotReceipt) {
      await ctx.reply(
        "Bu faylda Paynet cheki topilmadi. Iltimos, o'tkazma chekini yuboring."
      );
    }
    return;
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, BigInt(fromId)))
    .limit(1);

  if (!user) {
    await ctx.reply("Avval ilovaga kiring, keyin cheklarni yuboring.");
    return;
  }

  try {
    const result = await saveReceiptExpense(user.id, receipt);
    if (result.status === "duplicate") {
      await ctx.reply("Bu chek allaqachon qo'shilgan ✅");
      return;
    }
    const formatted = String(result.amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    await ctx.reply(
      `✅ Xarajat qo'shildi\n💳 ${result.cardName}\n💰 ${formatted} so'm`
    );
  } catch (error) {
    console.error("[telegram-bot] chekni saqlashda xato", error);
    await ctx.reply("Chekni saqlashda xatolik yuz berdi. Keyinroq urinib ko'ring.");
  }
}

// Botга forward qilingan Paynet chekini (matn) o'qib, avtomatik xarajat sifatida
// saqlaydi. Faqat loyiha egasining xabarlari qabul qilinadi.
bot.on("message:text", async (ctx) => {
  const fromId = ctx.from?.id;
  if (!fromId || fromId.toString() !== ALLOWED_TELEGRAM_ID) return;

  const text = ctx.message.text;
  if (text.startsWith("/")) return; // komandalar alohida ishlanadi

  await handleReceiptText(ctx, text, fromId, true);
});

// PDF chek yuborilganda: faylni yuklab olib, matnini ajratib, xuddi matn chek
// kabi qayta ishlaydi. Faqat loyiha egasi va faqat PDF fayllar qabul qilinadi.
bot.on("message:document", async (ctx) => {
  const fromId = ctx.from?.id;
  if (!fromId || fromId.toString() !== ALLOWED_TELEGRAM_ID) return;

  const doc = ctx.message.document;
  const isPdf =
    doc.mime_type === "application/pdf" ||
    (doc.file_name?.toLowerCase().endsWith(".pdf") ?? false);
  if (!isPdf) {
    await ctx.reply("Iltimos, chekni PDF fayl ko'rinishida yuboring.");
    return;
  }

  try {
    const file = await ctx.getFile(); // file_path'ni oladi
    if (!file.file_path) {
      await ctx.reply("Faylni yuklab bo'lmadi. Qaytadan urinib ko'ring.");
      return;
    }
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const res = await fetch(fileUrl);
    if (!res.ok) {
      await ctx.reply("Faylni yuklab bo'lmadi. Qaytadan urinib ko'ring.");
      return;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const text = await extractPdfText(bytes);
    await handleReceiptText(ctx, text, fromId, false);
  } catch (error) {
    console.error("[telegram-bot] PDF chekni o'qishda xato", error);
    await ctx.reply("PDF faylni o'qishda xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
});
