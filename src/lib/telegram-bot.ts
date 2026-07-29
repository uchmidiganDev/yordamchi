import { Bot, Context, InlineKeyboard, InputFile } from "grammy";
import { after } from "next/server";
import { eq, and, desc, gte, ne } from "drizzle-orm";
import { db } from "@/db";
import { users, loginTokens, businessMessages, veoJobs } from "@/db/schema";
import { transcribeAudio, generateImage, searchWeb, planPdfEdit } from "./gemini";
import { applyPdfEdit } from "./pdf-generator";
import { savePdfSession, getPdfSession, deletePdfSession } from "./pdf-flow";
import { savePhotoSession, getPhotoSession, deletePhotoSession } from "./photo-flow";
import { submitVideoJob, waitForVideoJob, downloadVideoBytes } from "./veo";
import { answerAssistantQuestion, answerGuestQuestion, type ConversationTurn } from "./assistant";
import { notifyOwnerOfTask } from "./owner-task";
import { replyAsPublicAssistant } from "./public-reply";
import { sendVoiceReply } from "./voice-reply";
import {
  analyzeWebsite,
  extractSoleUrl,
  fetchSiteHtml,
  getLatestAnalysis,
  improveWebsite,
  isFixRequest,
  saveAnalysis,
} from "./website-analyzer";
import {
  analyzeGroupMessage,
  banUser,
  enforceViolation,
  isAntispamEnabled,
  isGroupAdmin,
  kickUser,
  logModerationAction,
  muteUser,
  resetWarnings,
  runDeterministicChecks,
  setAntispamEnabled,
  unbanUser,
  unmuteUser,
  warnUser,
  WARN_MUTE_THRESHOLD,
} from "./group-moderation";
import { answerInGroup, extractMentionQuestion, extractOwnerDirectedQuestion } from "./group-assistant";
import { detectVideoLink, downloadVideoFromLink } from "./video-downloader";

const BUSINESS_HISTORY_LIMIT = 6;

// Rasm -> AI video (Veo) begona (business yoki ochiq DM'dagi begona)
// so'rovlar uchun kunlik chegara — haqiqiy pul sarflanadigani sabab
// (~$1.2/video). Egasining o'z DM'ida cheklovsiz.
const VEO_DAILY_GUEST_LIMIT = Number(process.env.VEO_DAILY_GUEST_LIMIT || "5");

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

// Mini-app'ni ochish uchun ("/app" buyrug'i va doimiy menyu tugmasi).
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

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

// Guruh moderatsiya buyruqlari (/mute, /ban va h.k.) FAQAT guruhda va FAQAT
// guruh administratori (yoki egasi) tomonidan chaqirilishi mumkin.
async function requireGroupAdmin(ctx: Context): Promise<boolean> {
  if (ctx.chat?.type === "private") return false;
  if (!(await isGroupAdmin(ctx))) {
    await ctx.reply("Bu buyruq faqat guruh administratorlari uchun.");
    return false;
  }
  return true;
}

// Moderatsiya buyruqlari maqsad foydalanuvchini REPLY orqali aniqlaydi —
// standart Telegram moderatsiya bot konvensiyasi.
function getReplyTarget(ctx: Context): { id: number; username: string | null } | null {
  const target = ctx.message?.reply_to_message?.from;
  if (!target || target.is_bot) return null;
  return { id: target.id, username: target.username ?? null };
}

bot.command(["ai", "ask", "chat"], async (ctx) => {
  if (ctx.chat.type === "private") return; // DM'da oddiy matn allaqachon AI Assistant'ga boradi
  const question = ctx.match?.toString().trim();
  if (!question) {
    await ctx.reply("Savolingizni yozing, masalan: /ai React nima?");
    return;
  }
  const owner = await getOwnerUser(Number(ALLOWED_TELEGRAM_ID));
  if (!owner) return;
  await answerInGroup(ctx, owner.id, question);
});

bot.command("antispam", async (ctx) => {
  if (!(await requireGroupAdmin(ctx))) return;
  const arg = ctx.match?.toString().trim().toLowerCase();
  if (arg !== "on" && arg !== "off") {
    await ctx.reply("Foydalanish: /antispam on yoki /antispam off");
    return;
  }
  await setAntispamEnabled(ctx.chat!.id, arg === "on");
  await ctx.reply(`Anti-spam ${arg === "on" ? "yoqildi ✅" : "o'chirildi ❌"}`);
});

const NO_PERMISSION_HINT =
  "❌ Bajarilmadi — botga bu amal uchun kerakli administrator huquqi berilmagan (Delete messages / Ban users). Guruh sozlamalarida botga shu huquqlarni bering.";

bot.command("mute", async (ctx) => {
  if (!(await requireGroupAdmin(ctx))) return;
  const target = getReplyTarget(ctx);
  if (!target) {
    await ctx.reply("Foydalanuvchini mute qilish uchun uning xabariga reply qilib /mute yozing.");
    return;
  }
  const ok = await muteUser(ctx, ctx.chat!.id, target.id);
  if (!ok) {
    await ctx.reply(NO_PERMISSION_HINT);
    return;
  }
  await logModerationAction(ctx.chat!.id, target.id, target.username, "muted", "Admin buyrug'i", null);
  await ctx.reply("✅ Foydalanuvchi mute qilindi (1 soat).");
});

bot.command("unmute", async (ctx) => {
  if (!(await requireGroupAdmin(ctx))) return;
  const target = getReplyTarget(ctx);
  if (!target) {
    await ctx.reply("Foydalanuvchini unmute qilish uchun uning xabariga reply qilib /unmute yozing.");
    return;
  }
  const ok = await unmuteUser(ctx, ctx.chat!.id, target.id);
  if (!ok) {
    await ctx.reply(NO_PERMISSION_HINT);
    return;
  }
  await resetWarnings(ctx.chat!.id, target.id);
  await ctx.reply("✅ Foydalanuvchi unmute qilindi.");
});

bot.command("ban", async (ctx) => {
  if (!(await requireGroupAdmin(ctx))) return;
  const target = getReplyTarget(ctx);
  if (!target) {
    await ctx.reply("Foydalanuvchini ban qilish uchun uning xabariga reply qilib /ban yozing.");
    return;
  }
  const ok = await banUser(ctx, ctx.chat!.id, target.id);
  if (!ok) {
    await ctx.reply(NO_PERMISSION_HINT);
    return;
  }
  await logModerationAction(ctx.chat!.id, target.id, target.username, "banned", "Admin buyrug'i", null);
  await ctx.reply("✅ Foydalanuvchi ban qilindi.");
});

bot.command("unban", async (ctx) => {
  if (!(await requireGroupAdmin(ctx))) return;
  const target = getReplyTarget(ctx);
  if (!target) {
    await ctx.reply("Foydalanuvchini unban qilish uchun uning xabariga reply qilib /unban yozing.");
    return;
  }
  const ok = await unbanUser(ctx, ctx.chat!.id, target.id);
  if (!ok) {
    await ctx.reply(NO_PERMISSION_HINT);
    return;
  }
  await ctx.reply("✅ Foydalanuvchi unban qilindi.");
});

bot.command("kick", async (ctx) => {
  if (!(await requireGroupAdmin(ctx))) return;
  const target = getReplyTarget(ctx);
  if (!target) {
    await ctx.reply("Foydalanuvchini kick qilish uchun uning xabariga reply qilib /kick yozing.");
    return;
  }
  const ok = await kickUser(ctx, ctx.chat!.id, target.id);
  if (!ok) {
    await ctx.reply(NO_PERMISSION_HINT);
    return;
  }
  await ctx.reply("✅ Foydalanuvchi guruhdan chiqarildi.");
});

bot.command("warn", async (ctx) => {
  if (!(await requireGroupAdmin(ctx))) return;
  const target = getReplyTarget(ctx);
  if (!target) {
    await ctx.reply("Foydalanuvchini ogohlantirish uchun uning xabariga reply qilib /warn yozing.");
    return;
  }
  const count = await warnUser(ctx.chat!.id, target.id);
  await logModerationAction(ctx.chat!.id, target.id, target.username, "warned", "Admin buyrug'i", null);
  await ctx.reply(`⚠️ Ogohlantirish berildi (${count}/${WARN_MUTE_THRESHOLD}).`);
  if (count >= WARN_MUTE_THRESHOLD) {
    const ok = await muteUser(ctx, ctx.chat!.id, target.id);
    if (ok) {
      await resetWarnings(ctx.chat!.id, target.id);
      await logModerationAction(ctx.chat!.id, target.id, target.username, "muted", "Ogohlantirish chegarasi", null);
      await ctx.reply("🔇 Ogohlantirish chegarasiga yetdi — foydalanuvchi mute qilindi.");
    } else {
      await ctx.reply(
        "⚠️ Ogohlantirish chegarasiga yetdi, lekin botda mute qilish huquqi yo'q — qo'lda cheklang."
      );
    }
  }
});

// Chek bo'lmagan xabarlarni AI Assistant'ga yuboradi — javob Bilim bazasi va
// System Prompt asosida shakllanadi (src/lib/assistant.ts). `withVoice` —
// ovozli xabardan kelgan savollar uchun javob FAQAT ovozli (TTS) shaklda
// qaytariladi (matn qo'shilmaydi); oddiy matn savollar uchun (false) javob
// FAQAT matn bo'ladi. TTS xato bersa, foydalanuvchi javobsiz qolmasligi
// uchun matnga qaytiladi (fallback).
async function handleAssistantMessage(
  ctx: Context,
  text: string,
  fromId: number,
  opts?: { withVoice?: boolean }
) {
  const user = await getOwnerUser(fromId);
  if (!user) {
    await ctx.reply("Avval ilovaga kiring, keyin savol bering.");
    return;
  }

  try {
    await ctx.replyWithChatAction("typing");
    const answer = await answerAssistantQuestion(user.id, text);
    if (opts?.withVoice) {
      const ok = await sendVoiceReply(ctx, answer);
      if (!ok) await ctx.reply(answer);
    } else {
      await ctx.reply(answer);
    }
  } catch (error) {
    console.error("[telegram-bot] AI Assistant xatosi", error);
    await ctx.reply("Javob berishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
  }
}

// "/img <tavsif>" buyrug'i — Gemini orqali rasm generatsiya qilib, foto
// sifatida yuboradi. Business xabarlarida `bot.command()` ishlamaydi
// (grammy'ning buyruq filtri faqat `message`/`channelPost`ni tekshiradi),
// shu sabab business_message handlerida shu matn qo'lda parse qilinadi —
// ikkalasi ham shu bitta yordamchini chaqiradi.
async function handleImageGeneration(ctx: Context, prompt: string) {
  try {
    await ctx.replyWithChatAction("upload_photo");
    const image = await generateImage(prompt);
    const ext = image.mimeType === "image/jpeg" ? "jpg" : "png";
    await ctx.replyWithPhoto(new InputFile(image.buffer, `rasm.${ext}`));
  } catch (error) {
    console.error("[telegram-bot] Rasm generatsiya qilishda xato", error);
    const message = error instanceof Error ? error.message : "noma'lum xato";
    await ctx.reply(`Rasm yaratib bo'lmadi: ${message}`);
  }
}

const IMG_COMMAND_RE = /^\/img(?:@\w+)?(?:\s+([\s\S]+))?$/i;

// Matnni "/img"ga mos keladimi tekshiradi. Mos kelmasa `null`, mos kelsa
// (tavsif bo'sh bo'lsa ham) tavsif matnini qaytaradi.
function parseImgCommand(text: string): string | null {
  const match = text.match(IMG_COMMAND_RE);
  if (!match) return null;
  return (match[1] ?? "").trim();
}

bot.command("img", async (ctx) => {
  if (ctx.chat.type !== "private") return; // faqat shaxsiy chatda
  const prompt = ctx.match?.toString().trim();
  if (!prompt) {
    await ctx.reply("Rasm tavsifini yozing, masalan: /img mushukning kosmosda uchayotgani");
    return;
  }
  await handleImageGeneration(ctx, prompt);
});

// "/search <so'rov>" buyrug'i — Gemini'ning google_search grounding tool'i
// orqali internetdan qidirib, ma'lumot va mavzuga oid video havolasini
// qaytaradi. /img'dagi kabi bot.command() (asosiy bot, shaxsiy chat) va
// business_message'da qo'lda regex parse qilish orqali ishlaydi.
async function handleSearch(ctx: Context, query: string) {
  try {
    await ctx.replyWithChatAction("typing");
    const result = await searchWeb(query);
    let message = result.answer;
    if (result.sources.length > 0) {
      message +=
        "\n\n🔗 Manbalar:\n" +
        result.sources.map((s) => `• ${s.title}: ${s.uri}`).join("\n");
    }
    await replyLong(ctx, message);
    if (result.videoUrl) {
      await ctx.reply(`🎥 Video: ${result.videoUrl}`);
    }
  } catch (error) {
    console.error("[telegram-bot] Qidiruvda xato", error);
    const message = error instanceof Error ? error.message : "noma'lum xato";
    await ctx.reply(`Qidirib bo'lmadi: ${message}`);
  }
}

const SEARCH_COMMAND_RE = /^\/search(?:@\w+)?(?:\s+([\s\S]+))?$/i;

// Matnni "/search"ga mos keladimi tekshiradi. Mos kelmasa `null`, mos
// kelsa (so'rov bo'sh bo'lsa ham) so'rov matnini qaytaradi.
function parseSearchCommand(text: string): string | null {
  const match = text.match(SEARCH_COMMAND_RE);
  if (!match) return null;
  return (match[1] ?? "").trim();
}

bot.command("search", async (ctx) => {
  if (ctx.chat.type !== "private") return; // faqat shaxsiy chatda
  const query = ctx.match?.toString().trim();
  if (!query) {
    await ctx.reply("Qidiruv so'zini yozing, masalan: /search kvant kompyuterlari");
    return;
  }
  await handleSearch(ctx, query);
});

// "/app" buyrug'i — web ilovani Telegram Mini App sifatida ochadigan
// inline tugma yuboradi. `web_app` tugmasi faqat shaxsiy chatlarda ishlaydi
// (Bot API cheklovi). Doimiy menyu tugmasi (setChatMenuButton) bilan bir
// xil manzilga ochiladi — ikkalasi ham bir xil mini-app kirish nuqtasi.
bot.command("app", async (ctx) => {
  if (ctx.chat.type !== "private") return;
  if (!APP_URL) {
    await ctx.reply("Ilova manzili sozlanmagan (NEXT_PUBLIC_APP_URL topilmadi).");
    return;
  }
  // "AI bilan suhbat" tugmasi to'g'ridan-to'g'ri /mehmon'ga ochiladi — bu
  // sahifa egalikni tekshirmaydi, shuning uchun egasi ham (ovozli suhbat
  // modalini sinash uchun) undan foydalana oladi, garchi asosiy oqimda
  // egasi mini-app ochganda avtomatik boshqaruv paneliga tushsa ham.
  await ctx.reply("Kerakli bo'limni tanlang:", {
    reply_markup: new InlineKeyboard()
      .webApp("📱 Boshqaruv paneli", APP_URL)
      .row()
      .webApp("🎙️ AI bilan suhbat", `${APP_URL}/mehmon`),
  });
});

// Uzun matnni Telegram xabar hajmi chegarasidan (4096 belgi) oshib
// ketmasligi uchun bir necha xabarga bo'lib yuboradi — paragraf chegaralari
// bo'yicha, zarur bo'lsa qattiq bo'lish bilan.
async function replyLong(
  ctx: Context,
  text: string,
  opts?: { limit?: number; parseMode?: "HTML" }
) {
  const limit = opts?.limit ?? 3500;
  const replyOpts = opts?.parseMode ? { parse_mode: opts.parseMode } : undefined;
  if (text.length <= limit) {
    await ctx.reply(text, replyOpts);
    return;
  }
  const parts: string[] = [];
  let current = "";
  for (const paragraph of text.split("\n\n")) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > limit) {
      if (current) parts.push(current);
      if (paragraph.length > limit) {
        for (let i = 0; i < paragraph.length; i += limit) {
          parts.push(paragraph.slice(i, i + limit));
        }
        current = "";
      } else {
        current = paragraph;
      }
    } else {
      current = candidate;
    }
  }
  if (current) parts.push(current);
  for (const part of parts) {
    await ctx.reply(part, replyOpts);
  }
}

// AI Website Analyzer: URL yuborilganda saytni yuklab, Gemini orqali tahlil
// qiladi va natijani shu suhbatga saqlaydi ("To'g'rila" uchun kerak bo'ladi).
async function handleWebsiteAnalysis(ctx: Context, url: string) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  try {
    await ctx.replyWithChatAction("typing");
    const { html, headers } = await fetchSiteHtml(url);
    const analysis = await analyzeWebsite(url, html, headers);
    await replyLong(ctx, analysis);
    await saveAnalysis(chatId, url, html, analysis);
  } catch (error) {
    console.error("[telegram-bot] website tahlilida xato", error);
    const message = error instanceof Error ? error.message : "noma'lum xato";
    await ctx.reply(`Saytni tahlil qilib bo'lmadi: ${message}`);
  }
}

// "To'g'rila" so'roviga javob: shu suhbatdagi oxirgi tahlil asosida
// yaxshilangan HTML/CSS fayl yaratib, hujjat sifatida yuboradi.
async function handleWebsiteFixRequest(ctx: Context) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const latest = await getLatestAnalysis(chatId);
  if (!latest) {
    await ctx.reply(
      "Avval tahlil qilish uchun sayt havolasini yuboring, keyin \"To'g'rila\" deb yozing."
    );
    return;
  }

  try {
    await ctx.replyWithChatAction("upload_document");
    const improved = await improveWebsite(latest.url, latest.html, latest.analysis);
    await ctx.replyWithDocument(
      new InputFile(Buffer.from(improved, "utf8"), "yaxshilangan.html"),
      { caption: `${latest.url} uchun yaxshilangan HTML/CSS kodi` }
    );
  } catch (error) {
    console.error("[telegram-bot] website tuzatishda xato", error);
    await ctx.reply("Kodni yaratishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
  }
}

// Botga yozilgan matn xabarlarni qayta ishlaydi. Loyiha egasi uchun: avval
// Paynet cheki sifatida sinaydi (forward qilingan chek bo'lsa xarajat
// sifatida saqlanadi), bo'lmasa AI Assistant'ga savol sifatida yuboradi.
// Begona foydalanuvchilar uchun: chek tekshiruvi o'tkazib yuboriladi (shaxsiy
// xarajat funksiyasi), to'g'ridan-to'g'ri Ommaviy bot bilan bir xil AI
// Assistant javobiga yo'naltiriladi (publicBotEnabled yoqilgan bo'lsagina).
// AI Group Moderation: guruh (group/supergroup) xabarlari BUTUNLAY alohida
// yo'lga (handleGroupMessage) yo'naltiriladi — chek/website/kod-assistant/AI
// Assistant DM oqimlari faqat shaxsiy chatda ma'noli, guruh spamida tasodifan
// ishga tushib ketmasligi uchun bu yerda to'xtatiladi.
//
// Shuningdek, guruhda kimdir EGAGA to'g'ridan-to'g'ri yozsa (uning
// @username'ini mention qilib yoki uning xabariga reply qilib), bot ega
// O'RNIDA AI javob beradi (extractOwnerDirectedQuestion) — foydalanuvchi
// aniq shuni so'ragan ("botim guruhdayam mani o'rnimdan gaplashadigan
// qilib ber"). Botni chaqirish (@BOT_USERNAME/reply-to-bot) ustuvor —
// ikkalasi ham mos kelsa (kamdan-kam holat), faqat bittasi javob beradi.
async function handleGroupMessage(ctx: Context) {
  const chatId = ctx.chat?.id;
  const fromId = ctx.from?.id;
  const text = ctx.message?.text;
  if (!chatId || !fromId || !text || ctx.from?.is_bot) return;

  if (await isAntispamEnabled(chatId)) {
    const username = ctx.from?.username ?? null;
    const isForwarded = Boolean(
      (ctx.message as unknown as { forward_origin?: unknown })?.forward_origin
    );
    const checks = await runDeterministicChecks(chatId, fromId, text, isForwarded);

    const violation =
      (checks.isFlood && "Flood (bir xil foydalanuvchidan juda ko'p xabar)") ||
      (checks.isDuplicate && "Takroriy xabar") ||
      (checks.isCapsSpam && "Caps Lock spam") ||
      (checks.isEmojiSpam && "Emoji spam") ||
      ((checks.isUsernameAd || checks.isBotAd) && "Username/bot/forward reklamasi") ||
      null;

    if (violation) {
      await enforceViolation(ctx, chatId, fromId, username, violation, text, false);
      return;
    }

    // Juda qisqa xabarlar uchun AI chaqiruvini tejaymiz (masalan "ha", "ok").
    if (text.trim().length >= 8) {
      try {
        const ai = await analyzeGroupMessage(text, checks.links);
        if (ai.riskLevel === "high") {
          await enforceViolation(
            ctx,
            chatId,
            fromId,
            username,
            `${ai.reason} (${ai.categories.join(", ") || "yuqori xavf"})`,
            text,
            true
          );
          return;
        }
        if (ai.isAd || ai.isProfanity || ai.riskLevel === "medium") {
          await enforceViolation(ctx, chatId, fromId, username, ai.reason, text, false);
          return;
        }
      } catch (error) {
        // AI xatoga uchrasa (masalan kvota) xabarni bloklamaymiz — soxta
        // pozitivlarni oldini olish uchun "fail-open" yondashuv.
        console.error("[telegram-bot] guruh AI moderatsiyasida xato", error);
      }
    }
  }

  const owner = await getOwnerUser(Number(ALLOWED_TELEGRAM_ID));
  if (!owner) return;

  const question =
    extractMentionQuestion(ctx) ??
    extractOwnerDirectedQuestion(ctx, Number(ALLOWED_TELEGRAM_ID), owner.telegramUsername);
  if (question) {
    await answerInGroup(ctx, owner.id, question);
  }
}

// "/pdf" oqimi: foydalanuvchi PDF fayl yuborsa, AI avval "Nima qilay?" deb
// so'raydi (pdf-flow.ts orqali kutilayotgan sessiya sifatida saqlanadi);
// shu chatdagi KEYINGI matn yoki ovozli xabar ko'rsatma sifatida qabul
// qilinib, natija yangi PDF hujjat sifatida qaytariladi. FAQAT shaxsiy
// chatda ishlaydi (guruh/business hozircha qo'llab-quvvatlanmaydi).
bot.on("message:document", async (ctx) => {
  if (ctx.chat.type !== "private") return;
  const doc = ctx.message.document;
  if (doc.mime_type !== "application/pdf") return;

  const owner = await getOwnerUser(Number(ALLOWED_TELEGRAM_ID));
  if (!owner) return;

  await savePdfSession(owner.id, ctx.chat.id, doc.file_id, doc.file_name ?? null);
  await ctx.reply(
    "📄 PDF qabul qilindi. Bu bilan nima qilib beray? (masalan: \"qisqacha xulosa qiling\", \"ingliz tiliga tarjima qiling\", \"matnini tuzating\") — matn yoki ovozli xabar bilan ayting."
  );
});

// Yuqoridagi "/pdf" oqimidagi kutilayotgan ko'rsatmani bajaradi: saqlangan
// file_id orqali PDF qayta yuklab olinadi (bazada faqat file_id saqlanadi,
// baytlar emas), Gemini qaysi sahifa(lar)ga tegishli ekanini va o'sha
// sahifa(lar) uchun yangi matnni aniqlaydi (planPdfEdit), so'ng FAQAT
// o'sha sahifa(lar) almashtirilib, qolgan barcha sahifalar asl dizaynda
// saqlanadi (applyPdfEdit) — foydalanuvchi "dizaynga tegmasin, faqat
// aytgan joyni o'zgartirsin" deb aniq so'ragani uchun. Muvaffaqiyatli
// yoki xato bo'lishidan qat'i nazar sessiya tozalanadi — aks holda
// foydalanuvchi keyingi har qanday xabari xato tarzda shu eski PDF'ga
// ko'rsatma sifatida qabul qilinaverardi.
async function handlePdfInstruction(
  ctx: Context,
  session: { fileId: string; fileName: string | null },
  instruction: string
) {
  try {
    await ctx.replyWithChatAction("upload_document");
    const file = await ctx.api.getFile(session.fileId);
    if (!file.file_path) throw new Error("PDF faylini topib bo'lmadi");
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`PDF faylini yuklab bo'lmadi (${res.status})`);
    const bytes = Buffer.from(await res.arrayBuffer());

    const plan = await planPdfEdit(bytes.toString("base64"), instruction);
    const pdfBuffer = await applyPdfEdit(bytes, plan.pageNumbers, plan.newText);

    const outName = session.fileName ? `tahrirlangan-${session.fileName}` : "tahrirlangan-hujjat.pdf";
    await ctx.reply(`✅ ${plan.summary}`);
    await ctx.replyWithDocument(new InputFile(pdfBuffer, outName));
  } catch (error) {
    console.error("[telegram-bot] PDF ko'rsatmasini bajarishda xato", error);
    const message = error instanceof Error ? error.message : "noma'lum xato";
    try {
      await ctx.reply(`PDF'ni qayta ishlab bo'lmadi: ${message}`);
    } catch (replyError) {
      // Xatoni xabar qilishning o'zi ham muvaffaqiyatsiz bo'lsa (masalan
      // Telegram API vaqtinchalik xato bersa), butun webhook so'rovini
      // 500'ga qulatmasdan shunchaki logga yozib qo'yamiz.
      console.error("[telegram-bot] Xato haqida xabar berishning o'zi muvaffaqiyatsiz", replyError);
    }
  } finally {
    if (ctx.chat) await deletePdfSession(ctx.chat.id);
  }
}

// Rasm -> AI video generatsiya (Google Veo): submit qilingach fon rejimida
// (Next.js `after()`) natija kutiladi va tugagach video Telegram'ga
// yuboriladi. Bounded wait — belgilangan vaqt ichida tugamasa (odatiy holat
// EMAS, lekin Vercel funksiya vaqti cheklangani sabab) aniq xato xabari
// bilan to'xtatiladi va veoJobs "failed" belgilanadi — /img'dagi bilan bir
// xil "eng yaxshi urinish, cheklangan kutish" naqshi (2026-07-24'dagi qaror).
// MUHIM: jonli sinovda (2026-07-29) aniqlandi — realistik odam portretida
// generatsiya ~90-100s davom etishi mumkin (stilizatsiya qilingan avatar
// rasmidagi ~44s'dan sezilarli uzoqroq), avvalgi 45s chegara BUNDAY holatlarda
// video haqiqatda muvaffaqiyatli yaratilgan bo'lsa ham "vaqt chegarasidan
// oshib ketdi" xatosini bergan (video Google serverida tayyor turgan, faqat
// biz yetarlicha kutmagan edik). webhook route'idagi maxDuration ham (120s)
// shunga mos 180s'ga oshirildi.
const VEO_WAIT_DEADLINE_MS = 100_000;

async function processVeoJob(jobId: string, chatId: number, operationName: string) {
  const result = await waitForVideoJob(operationName, VEO_WAIT_DEADLINE_MS);

  if ("error" in result) {
    await db
      .update(veoJobs)
      .set({ status: "failed", errorMessage: result.error, updatedAt: new Date() })
      .where(eq(veoJobs.id, jobId));
    await bot.api
      .sendMessage(chatId, `Video yaratib bo'lmadi: ${result.error}`)
      .catch((error) => console.error("[telegram-bot] Veo xato xabarini yuborishda xato", error));
    return;
  }

  try {
    await bot.api.sendChatAction(chatId, "upload_video").catch(() => {});
    const buffer = await downloadVideoBytes(result.videoUri);
    await bot.api.sendVideo(chatId, new InputFile(buffer, "video.mp4"));
    await db
      .update(veoJobs)
      .set({ status: "done", updatedAt: new Date() })
      .where(eq(veoJobs.id, jobId));
  } catch (error) {
    console.error("[telegram-bot] Veo videoni yuborishda xato", error);
    const message = error instanceof Error ? error.message : "noma'lum xato";
    await db
      .update(veoJobs)
      .set({ status: "failed", errorMessage: message, updatedAt: new Date() })
      .where(eq(veoJobs.id, jobId));
    await bot.api
      .sendMessage(chatId, `Video yaratildi, lekin yuborib bo'lmadi: ${message}`)
      .catch((sendError) => console.error("[telegram-bot] Veo xato xabarini yuborishda xato", sendError));
  }
}

// Begona (business yoki ochiq DM'dagi begona) so'rovlar uchun kunlik chegara
// — bugun shu egaga tegishli, EGANING O'Z DM chatidan kelmagan veoJobs soni.
async function isVeoGuestQuotaExceeded(ownerId: string): Promise<boolean> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const rows = await db
    .select({ id: veoJobs.id })
    .from(veoJobs)
    .where(
      and(
        eq(veoJobs.userId, ownerId),
        gte(veoJobs.createdAt, startOfDay),
        ne(veoJobs.chatId, BigInt(ALLOWED_TELEGRAM_ID as string))
      )
    );
  return rows.length >= VEO_DAILY_GUEST_LIMIT;
}

// Rasm+ko'rsatma tayyor bo'lganda haqiqiy Veo topshirig'ini yuboradi: rasm
// file_id orqali qayta yuklab olinadi (bazada faqat file_id saqlanadi,
// baytlar emas — pdf-flow.ts'dagi bilan bir xil naqsh), submitVideoJob()
// bilan topshiriladi, veoJobs'ga yozib qo'yiladi, foydalanuvchiga darhol
// "tayyorlanmoqda" xabari beriladi va natija fon rejimida (`after()`)
// kutib olinadi — bu bilan webhook so'rovining o'zi darhol tugaydi.
async function handlePhotoInstruction(
  ctx: Context,
  ownerId: string,
  chatId: number,
  fileId: string,
  instruction: string,
  isGuest: boolean
) {
  if (isGuest && (await isVeoGuestQuotaExceeded(ownerId))) {
    await ctx.reply(
      `Bugungi video yaratish limiti (${VEO_DAILY_GUEST_LIMIT} ta) tugadi. Ertaga qayta urinib ko'ring.`
    );
    await deletePhotoSession(chatId);
    return;
  }

  try {
    await ctx.replyWithChatAction("upload_video");
    const file = await ctx.api.getFile(fileId);
    if (!file.file_path) throw new Error("Rasm faylini topib bo'lmadi");
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`Rasm faylini yuklab bo'lmadi (${res.status})`);
    const bytes = Buffer.from(await res.arrayBuffer());

    const operationName = await submitVideoJob(instruction, bytes.toString("base64"), "image/jpeg");
    const [job] = await db
      .insert(veoJobs)
      .values({ userId: ownerId, chatId: BigInt(chatId), prompt: instruction, operationName })
      .returning();

    await ctx.reply(
      "🎬 Video tayyorlanmoqda, odatda bir necha o'n soniya vaqt oladi. Tayyor bo'lganda avtomatik yuboraman."
    );
    after(() => processVeoJob(job.id, chatId, operationName));
  } catch (error) {
    console.error("[telegram-bot] Veo video topshirishda xato", error);
    const message = error instanceof Error ? error.message : "noma'lum xato";
    await ctx.reply(`Video yaratib bo'lmadi: ${message}`);
  } finally {
    await deletePhotoSession(chatId);
  }
}

// Rasm -> AI video (Veo) oqimi: rasm caption bilan kelsa caption darhol
// ko'rsatma sifatida ishlatiladi; caption'siz kelsa "Bu odam nima desin?"
// deb so'raladi va KEYINGI matn/ovozli xabar ko'rsatma sifatida qabul
// qilinadi (pastdagi message:text/message:voice handlerlarida davom etadi).
// FAQAT shaxsiy chatda ishlaydi. Egasining o'z DM'ida cheklovsiz va
// sozlamasiz ishlaydi (o'z-o'zini sinash); begona uchun "/shaxsiy-ai"
// sahifasidagi businessVideoGenerationEnabled yoqilgan bo'lishi SHART
// (haqiqiy pul sarflanadigani sabab standart holatda o'chiq) va kunlik
// VEO_DAILY_GUEST_LIMIT qo'llanadi.
bot.on("message:photo", async (ctx) => {
  if (ctx.chat.type !== "private") return;
  const fromId = ctx.from?.id;
  if (!fromId) return;

  const owner = await getOwnerUser(Number(ALLOWED_TELEGRAM_ID));
  if (!owner) return;

  const isGuest = fromId.toString() !== ALLOWED_TELEGRAM_ID;
  if (isGuest && !owner.businessVideoGenerationEnabled) {
    await ctx.reply("Kechirasiz, hozircha rasmlarni qabul qila olmayman.");
    return;
  }

  const photo = ctx.message.photo[ctx.message.photo.length - 1];
  const caption = ctx.message.caption?.trim();

  if (caption) {
    await handlePhotoInstruction(ctx, owner.id, ctx.chat.id, photo.file_id, caption, isGuest);
    return;
  }

  await savePhotoSession(owner.id, ctx.chat.id, photo.file_id);
  await ctx.reply("🖼️ Rasm qabul qilindi. Bu odam nima desin? Matn yoki ovozli xabar bilan ayting.");
});

// AI Website Analyzer (URL yuborish / "To'g'rila") kimdan kelishidan
// qat'i nazar ishlaydi — shaxsiy AI Assistant tekshiruvidan OLDIN.
// Bu FAQAT shaxsiy chatda (private) ishlaydi — guruh
// xabarlari yuqoridagi handleGroupMessage'ga yo'naltiriladi.
bot.on("message:text", async (ctx) => {
  if (ctx.chat.type !== "private") {
    await handleGroupMessage(ctx);
    return;
  }

  const fromId = ctx.from?.id;
  if (!fromId) return;

  const text = ctx.message.text;
  if (text.startsWith("/")) return; // komandalar alohida ishlanadi

  const pendingPdf = await getPdfSession(ctx.chat.id);
  if (pendingPdf) {
    await handlePdfInstruction(ctx, pendingPdf, text);
    return;
  }

  const pendingPhoto = await getPhotoSession(ctx.chat.id);
  if (pendingPhoto) {
    await handlePhotoInstruction(
      ctx,
      pendingPhoto.userId,
      ctx.chat.id,
      pendingPhoto.fileId,
      text,
      fromId.toString() !== ALLOWED_TELEGRAM_ID
    );
    return;
  }

  if (isFixRequest(text)) {
    await handleWebsiteFixRequest(ctx);
    return;
  }

  const analyzeUrl = extractSoleUrl(text);
  if (analyzeUrl) {
    await handleWebsiteAnalysis(ctx, analyzeUrl);
    return;
  }

  if (fromId.toString() !== ALLOWED_TELEGRAM_ID) {
    await replyAsPublicAssistant(ctx, text);
    return;
  }

  await handleAssistantMessage(ctx, text, fromId);
});

// Ovozli xabar (Voice Message): Gemini orqali matnga aylantiriladi
// (o'zbek/rus/ingliz avtomatik aniqlanadi), so'ng xuddi matn xabar kabi AI
// Assistant'ga yuboriladi — farqi shundaki, javob matn bilan birga ovozli
// (TTS) shaklda ham qaytariladi. Chek tekshiruvi qo'llanilmaydi — ovozli
// xabar orqali chek yuborish qo'llab-quvvatlanmaydi.
bot.on("message:voice", async (ctx) => {
  const fromId = ctx.from?.id;
  if (!fromId) return;

  let transcript: string;
  try {
    const file = await ctx.getFile();
    if (!file.file_path) throw new Error("file_path yo'q");
    const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`ovoz faylini yuklab bo'lmadi (${res.status})`);
    const bytes = Buffer.from(await res.arrayBuffer());
    transcript = await transcribeAudio(
      bytes.toString("base64"),
      ctx.message.voice.mime_type ?? "audio/ogg"
    );
  } catch (error) {
    console.error("[telegram-bot] ovozni transkripsiya qilishda xato", error);
    await ctx.reply("Kechirasiz, ovozni tushuna olmadim. Iltimos qayta yozib yuboring.");
    return;
  }

  if (!transcript.trim()) {
    await ctx.reply("Kechirasiz, ovozni tushuna olmadim. Iltimos qayta yozib yuboring.");
    return;
  }

  const pendingPdf = ctx.chat ? await getPdfSession(ctx.chat.id) : null;
  if (pendingPdf) {
    await handlePdfInstruction(ctx, pendingPdf, transcript);
    return;
  }

  const pendingPhoto = ctx.chat ? await getPhotoSession(ctx.chat.id) : null;
  if (pendingPhoto) {
    await handlePhotoInstruction(
      ctx,
      pendingPhoto.userId,
      ctx.chat!.id,
      pendingPhoto.fileId,
      transcript,
      fromId.toString() !== ALLOWED_TELEGRAM_ID
    );
    return;
  }

  if (fromId.toString() !== ALLOWED_TELEGRAM_ID) {
    await replyAsPublicAssistant(ctx, transcript, { withVoice: true });
    return;
  }

  await handleAssistantMessage(ctx, transcript, fromId, { withVoice: true });
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
//
// "/shaxsiy-ai" sahifasidagi sozlamalarga qarab (businessVoiceReplyEnabled/
// businessLinkAnalysisEnabled/businessVideoDownloadEnabled) qo'shimcha uch
// imkoniyat qo'llab-quvvatlanadi: ovozli xabar -> matn+ovoz javob, oddiy
// link -> website tahlili, YouTube/Instagram link -> video yuklab berish.
bot.on("business_message", async (ctx) => {
  const msg = ctx.businessMessage;
  if (!msg || msg.from?.id.toString() === ALLOWED_TELEGRAM_ID) return;

  const owner = await getOwnerUser(Number(ALLOWED_TELEGRAM_ID));
  if (!owner) return;

  const chatId = msg.chat.id;
  const fromName =
    [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") || null;
  const fromUsername = msg.from?.username ?? null;

  let text = msg.text;
  let isVoiceOrigin = false;

  // "/pdf" oqimi (asosiy botdagi bilan bir xil mantiq): PDF fayl kelsa
  // "Nima qilay?" deb so'raladi, keyingi xabar ko'rsatma sifatida qabul
  // qilinadi. Do'st sinovida aniqlangan: avval bu Business xabarlarida
  // UMUMAN ishlamas edi (faqat asosiy bot uchun yozilgan edi) — begonalar
  // odatda botga emas, egasining shaxsiy raqamiga (Business orqali)
  // yozishadi, shu sabab bu yerga ham qo'shildi.
  if (!text && msg.document) {
    if (msg.document.mime_type === "application/pdf") {
      await savePdfSession(owner.id, chatId, msg.document.file_id, msg.document.file_name ?? null);
      await ctx.reply(
        "📄 PDF qabul qilindi. Bu bilan nima qilib beray? (masalan: \"qisqacha xulosa qiling\", \"ingliz tiliga tarjima qiling\", \"matnini tuzating\") — matn yoki ovozli xabar bilan ayting."
      );
      return;
    }
  }

  // Rasm -> AI video (Veo): asosiy botdagi bot.on("message:photo") bilan bir
  // xil mantiq, faqat bu yerda barcha xabarlar tabiatan begona (Business
  // xabarlarida egasining o'z xabarlari yuqorida allaqachon filtrlangan) —
  // shu sabab isGuest doim true va businessVideoGenerationEnabled orqali
  // gate qilinadi.
  if (!text && msg.photo) {
    if (!owner.businessVideoGenerationEnabled) {
      await ctx.reply("Kechirasiz, hozircha rasmlarni qabul qila olmayman.");
      return;
    }
    const photo = msg.photo[msg.photo.length - 1];
    const caption = msg.caption?.trim();
    if (caption) {
      await handlePhotoInstruction(ctx, owner.id, chatId, photo.file_id, caption, true);
      return;
    }
    await savePhotoSession(owner.id, chatId, photo.file_id);
    await ctx.reply("🖼️ Rasm qabul qilindi. Bu odam nima desin? Matn yoki ovozli xabar bilan ayting.");
    return;
  }

  if (!text && msg.voice) {
    if (!owner.businessVoiceReplyEnabled) {
      await ctx.reply("Hozircha ovozli xabarlarni qabul qilmayapman.");
      return;
    }
    try {
      const file = await ctx.getFile();
      if (!file.file_path) throw new Error("file_path yo'q");
      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`ovoz faylini yuklab bo'lmadi (${res.status})`);
      const bytes = Buffer.from(await res.arrayBuffer());
      text = await transcribeAudio(bytes.toString("base64"), msg.voice.mime_type ?? "audio/ogg");
      isVoiceOrigin = true;
    } catch (error) {
      console.error("[telegram-bot] Business ovozni transkripsiya qilishda xato", error);
      await ctx.reply("Kechirasiz, ovozni tushuna olmadim. Iltimos qayta yozib yuboring.");
      return;
    }
    if (!text?.trim()) {
      await ctx.reply("Kechirasiz, ovozni tushuna olmadim. Iltimos qayta yozib yuboring.");
      return;
    }
  }

  if (!text) {
    await ctx.reply("Hozircha faqat matnli yoki ovozli xabarlarni qabul qila olaman.");
    return;
  }

  const pendingPdf = await getPdfSession(chatId);
  if (pendingPdf) {
    await handlePdfInstruction(ctx, pendingPdf, text);
    return;
  }

  const pendingPhoto = await getPhotoSession(chatId);
  if (pendingPhoto) {
    await handlePhotoInstruction(ctx, owner.id, chatId, pendingPhoto.fileId, text, true);
    return;
  }

  const imgPrompt = parseImgCommand(text);
  if (imgPrompt !== null) {
    if (!imgPrompt) {
      await ctx.reply("Rasm tavsifini yozing, masalan: /img mushukning kosmosda uchayotgani");
      return;
    }
    await handleImageGeneration(ctx, imgPrompt);
    return;
  }

  const searchQuery = parseSearchCommand(text);
  if (searchQuery !== null) {
    if (!searchQuery) {
      await ctx.reply("Qidiruv so'zini yozing, masalan: /search kvant kompyuterlari");
      return;
    }
    await handleSearch(ctx, searchQuery);
    return;
  }

  if (owner.businessVideoDownloadEnabled) {
    const videoKind = detectVideoLink(text);
    if (videoKind) {
      try {
        await ctx.replyWithChatAction("upload_video");
        const video = await downloadVideoFromLink(text, videoKind);
        await ctx.replyWithVideo(new InputFile(video.buffer, video.filename));
      } catch (error) {
        console.error("[telegram-bot] Business video yuklab olishda xato", error);
        const message = error instanceof Error ? error.message : "noma'lum xato";
        await ctx.reply(`Videoni yuklab bo'lmadi: ${message}`);
      }
      return;
    }
  }

  if (owner.businessLinkAnalysisEnabled) {
    const analyzeUrl = extractSoleUrl(text);
    if (analyzeUrl) {
      try {
        await ctx.replyWithChatAction("typing");
        const { html, headers } = await fetchSiteHtml(analyzeUrl);
        const analysis = await analyzeWebsite(analyzeUrl, html, headers);
        await replyLong(ctx, analysis);
        await saveAnalysis(chatId, analyzeUrl, html, analysis);
      } catch (error) {
        console.error("[telegram-bot] Business website tahlilida xato", error);
        const message = error instanceof Error ? error.message : "noma'lum xato";
        await ctx.reply(`Saytni tahlil qilib bo'lmadi: ${message}`);
      }
      return;
    }
  }

  async function logAndReply(answer: string) {
    if (isVoiceOrigin && owner!.businessVoiceReplyEnabled) {
      const ok = await sendVoiceReply(ctx, answer);
      if (!ok) await ctx.reply(answer);
    } else {
      await ctx.reply(answer);
    }
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

    const { answer, ownerTask } = await answerGuestQuestion(
      owner.id,
      text,
      history,
      fromName ?? fromUsername
    );
    if (ownerTask) {
      await notifyOwnerOfTask(owner.id, ownerTask, `${fromName ?? fromUsername ?? "Mijoz"}, Business`);
    }
    await logAndReply(answer);
  } catch (error) {
    console.error("[telegram-bot] Business AI Assistant xatosi", error);
    await logAndReply(
      "Kechirasiz, hozir javob berishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring."
    );
  }
});

