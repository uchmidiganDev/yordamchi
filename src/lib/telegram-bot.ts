import { Bot, Context } from "grammy";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { users, loginTokens, businessMessages } from "@/db/schema";
import { parsePaynetReceipt } from "./paynet-receipt";
import { parseGenericReceipt } from "./generic-receipt";
import { saveReceiptExpense, saveGenericExpense } from "./expense-from-receipt";
import type { ReceiptSaveResult } from "./expense-from-receipt";
import { extractPdfText } from "./pdf-text";
import { answerAssistantQuestion, type ConversationTurn } from "./assistant";
import { replyAsPublicAssistant } from "./public-reply";

const BUSINESS_HISTORY_LIMIT = 6;

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
      "Bu ilovaga kirish faqat egasiga tegishli. Lekin menga to'g'ridan-to'g'ri savol yozishingiz mumkin — yordam berishga harakat qilaman."
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

// Loyiha egasining foydalanuvchi yozuvini oladi (telegram id bo'yicha).
async function getOwnerUser(fromId: number) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, BigInt(fromId)))
    .limit(1);
  return user ?? null;
}

// Saqlash natijasini foydalanuvchiga javob sifatida yuboradi.
async function replySaveResult(ctx: Context, result: ReceiptSaveResult) {
  if (result.status === "duplicate") {
    await ctx.reply("Bu chek allaqachon qo'shilgan ✅");
    return;
  }
  const formatted = String(result.amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  await ctx.reply(
    `✅ Xarajat qo'shildi\n💳 ${result.cardName}\n💰 ${formatted} so'm`
  );
}

// Matn chekini (Paynet formati) parse qilib, xarajat sifatida saqlaydi.
// Chek topilmasa `false` qaytaradi — chaqiruvchi xabarni AI Assistant'ga
// yuboradi.
async function handleReceiptText(
  ctx: Context,
  text: string,
  fromId: number
): Promise<boolean> {
  const receipt = parsePaynetReceipt(text);
  if (!receipt) return false;

  const user = await getOwnerUser(fromId);
  if (!user) {
    await ctx.reply("Avval ilovaga kiring, keyin cheklarni yuboring.");
    return true;
  }

  try {
    const result = await saveReceiptExpense(user.id, receipt);
    await replySaveResult(ctx, result);
  } catch (error) {
    console.error("[telegram-bot] chekni saqlashda xato", error);
    await ctx.reply("Chekni saqlashda xatolik yuz berdi. Keyinroq urinib ko'ring.");
  }
  return true;
}

// Chek bo'lmagan xabarlarni AI Assistant'ga yuboradi — javob Bilim bazasi va
// System Prompt asosida shakllanadi (src/lib/assistant.ts).
async function handleAssistantMessage(ctx: Context, text: string, fromId: number) {
  const user = await getOwnerUser(fromId);
  if (!user) {
    await ctx.reply("Avval ilovaga kiring, keyin savol bering.");
    return;
  }

  try {
    await ctx.replyWithChatAction("typing");
    const answer = await answerAssistantQuestion(user.id, text);
    await ctx.reply(answer);
  } catch (error) {
    console.error("[telegram-bot] AI Assistant xatosi", error);
    await ctx.reply("Javob berishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
  }
}

// Botga yozilgan matn xabarlarni qayta ishlaydi. Loyiha egasi uchun: avval
// Paynet cheki sifatida sinaydi (forward qilingan chek bo'lsa xarajat
// sifatida saqlanadi), bo'lmasa AI Assistant'ga savol sifatida yuboradi.
// Begona foydalanuvchilar uchun: chek tekshiruvi o'tkazib yuboriladi (shaxsiy
// xarajat funksiyasi), to'g'ridan-to'g'ri Ommaviy bot bilan bir xil AI
// Assistant javobiga yo'naltiriladi (publicBotEnabled yoqilgan bo'lsagina).
bot.on("message:text", async (ctx) => {
  const fromId = ctx.from?.id;
  if (!fromId) return;

  const text = ctx.message.text;
  if (text.startsWith("/")) return; // komandalar alohida ishlanadi

  if (fromId.toString() !== ALLOWED_TELEGRAM_ID) {
    await replyAsPublicAssistant(ctx, text);
    return;
  }

  const wasReceipt = await handleReceiptText(ctx, text, fromId);
  if (!wasReceipt) {
    await handleAssistantMessage(ctx, text, fromId);
  }
});

// Telegram Business: foydalanuvchi botni shaxsiy akkauntiga "AI Assistant"
// sifatida ulaganda (yoki ulanish holatini o'zgartirganda) keladi. Ulanish
// holatini bazaga yozib qo'yamiz — funksional jihatdan shart emas (Telegram
// o'zi qaysi xabarlarni yuborishni boshqaradi), lekin holatni /telegram
// sahifasida ko'rsatish uchun kerak.
bot.on("business_connection", async (ctx) => {
  const conn = ctx.businessConnection;
  if (!conn || conn.user.id.toString() !== ALLOWED_TELEGRAM_ID) return;

  await db
    .update(users)
    .set({
      businessConnectionId: conn.id,
      businessConnectionEnabled: conn.is_enabled,
    })
    .where(eq(users.telegramId, BigInt(ALLOWED_TELEGRAM_ID as string)));

  console.log("[telegram-bot] Business ulanish yangilandi", {
    id: conn.id,
    enabled: conn.is_enabled,
  });
});

// Telegram Business orqali shaxsiy akkauntga kelgan xabarlar. Bu yangilanish
// suhbatning HAR IKKI tomonini o'z ichiga oladi (mijozning xabarlari HAM,
// egasining telefonidan qo'lda yozgan javoblari HAM) — shuning uchun
// egasining o'z xabarlarini e'tiborsiz qoldirish SHART, aks holda AI
// egasining javobiga ham "javob" berishga urinadi.
bot.on("business_message", async (ctx) => {
  const msg = ctx.businessMessage;
  if (!msg || msg.from?.id.toString() === ALLOWED_TELEGRAM_ID) return;

  const text = msg.text;
  if (!text) {
    await ctx.reply("Hozircha faqat matnli xabarlarni qabul qila olaman.");
    return;
  }

  const owner = await getOwnerUser(Number(ALLOWED_TELEGRAM_ID));
  if (!owner) return;

  const chatId = msg.chat.id;
  const fromName =
    [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || null;
  const fromUsername = msg.from?.username ?? null;

  async function logAndReply(answer: string) {
    await ctx.reply(answer);
    await db.insert(businessMessages).values({
      userId: owner!.id,
      chatId: BigInt(chatId),
      fromName,
      fromUsername,
      text: text as string,
      answer,
    });
  }

  try {
    await ctx.replyWithChatAction("typing");

    const historyRows = await db
      .select({ text: businessMessages.text, answer: businessMessages.answer })
      .from(businessMessages)
      .where(
        and(eq(businessMessages.userId, owner.id), eq(businessMessages.chatId, BigInt(chatId)))
      )
      .orderBy(desc(businessMessages.createdAt))
      .limit(BUSINESS_HISTORY_LIMIT);

    const history: ConversationTurn[] = historyRows
      .reverse()
      .filter((r): r is { text: string; answer: string } => r.answer !== null)
      .map((r) => ({ question: r.text, answer: r.answer }));

    const answer = await answerAssistantQuestion(owner.id, text, history);
    await logAndReply(answer);
  } catch (error) {
    console.error("[telegram-bot] Business AI Assistant xatosi", error);
    await logAndReply(
      "Kechirasiz, hozir javob berishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring."
    );
  }
});

// PDF yuborilganda: faylni yuklab olib, matnini ajratadi. Avval Paynet cheki
// sifatida sinaydi; bo'lmasa istalgan PDF'dan summani topib xarajatga qo'shadi.
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

    const user = await getOwnerUser(fromId);
    if (!user) {
      await ctx.reply("Avval ilovaga kiring, keyin cheklarni yuboring.");
      return;
    }

    // Avval Paynet formatida sinaymiz (karta va tranzaksiya ma'lumoti aniqroq).
    const paynet = parsePaynetReceipt(text);
    if (paynet) {
      const result = await saveReceiptExpense(user.id, paynet);
      await replySaveResult(ctx, result);
      return;
    }

    // Aks holda istalgan PDF'dan summani ajratib, xarajatga qo'shamiz.
    const generic = parseGenericReceipt(text, doc.file_name ?? "PDF chek");
    if (!generic) {
      await ctx.reply(
        "PDF ochildi, lekin ichidan summa topilmadi. Chekda summa borligini tekshiring."
      );
      return;
    }
    const result = await saveGenericExpense(user.id, generic);
    await replySaveResult(ctx, result);
  } catch (error) {
    console.error("[telegram-bot] PDF chekni o'qishda xato", error);
    await ctx.reply("PDF faylni o'qishda xatolik yuz berdi. Qaytadan urinib ko'ring.");
  }
});
