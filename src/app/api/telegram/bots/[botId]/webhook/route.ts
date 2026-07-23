// /telegram sahifasida qo'shilgan har qanday bot uchun umumiy webhook.
// grammy ishlatilmaydi — bitta oddiy HTTP handler barcha dinamik botlarni
// xizmat qiladi (telegram-api.ts orqali). Har bir suhbat (chatId) tarixi
// telegram_messages'da saqlanadi va keyingi javobga kontekst sifatida
// uzatiladi.

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { telegramBots, telegramMessages } from "@/db/schema";
import { sendChatAction, sendMessage } from "@/lib/telegram-api";
import { answerGuestQuestion, type ConversationTurn } from "@/lib/assistant";
import { notifyOwnerOfTask } from "@/lib/owner-task";

const HISTORY_LIMIT = 6;

// Asosiy webhook route'dagi bilan bir xil xavfsizlik zaxirasi (standart
// 10s ba'zan Gemini chaqiruvi uchun yetarli emas).
export const maxDuration = 60;

type TelegramUpdate = {
  message?: {
    text?: string;
    chat?: { id?: number };
    from?: { first_name?: string; last_name?: string; username?: string };
  };
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ botId: string }> }
) {
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  if (secretHeader !== process.env.TG_PUBLIC_BOT_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { botId } = await params;
  const [bot] = await db
    .select()
    .from(telegramBots)
    .where(eq(telegramBots.id, botId))
    .limit(1);
  if (!bot) return new Response("Not found", { status: 404 });

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
  const message = update?.message;
  const text = message?.text;
  const chatId = message?.chat?.id;
  if (!text || chatId === undefined) return new Response("OK");

  if (text.startsWith("/start")) {
    await sendMessage(
      bot.token,
      chatId,
      "Salom! Savolingizni yozing — bilim bazasi asosida javob beraman."
    );
    return new Response("OK");
  }
  if (text.startsWith("/")) return new Response("OK"); // boshqa komandalar e'tiborsiz

  const fromName =
    [message?.from?.first_name, message?.from?.last_name].filter(Boolean).join(" ") || null;
  const fromUsername = message?.from?.username ?? null;

  async function logAndReply(answer: string) {
    await sendMessage(bot.token, chatId as number, answer);
    await db.insert(telegramMessages).values({
      botId: bot.id,
      userId: bot.userId,
      chatId: BigInt(chatId as number),
      fromName,
      fromUsername,
      text: text as string,
      answer,
    });
  }

  if (!bot.enabled) {
    await logAndReply("Hozircha javob bermayapti. Birozdan so'ng qayta urinib ko'ring.");
    return new Response("OK");
  }

  try {
    await sendChatAction(bot.token, chatId, "typing");

    const historyRows = await db
      .select({ text: telegramMessages.text, answer: telegramMessages.answer })
      .from(telegramMessages)
      .where(
        and(eq(telegramMessages.botId, bot.id), eq(telegramMessages.chatId, BigInt(chatId)))
      )
      .orderBy(desc(telegramMessages.createdAt))
      .limit(HISTORY_LIMIT);

    const history: ConversationTurn[] = historyRows
      .reverse()
      .filter((r): r is { text: string; answer: string } => r.answer !== null)
      .map((r) => ({ question: r.text, answer: r.answer }));

    const { answer, ownerTask } = await answerGuestQuestion(
      bot.userId,
      text,
      history,
      fromName ?? fromUsername
    );
    if (ownerTask) {
      await notifyOwnerOfTask(bot.userId, ownerTask, `${fromName ?? fromUsername ?? "Mijoz"}, @${bot.username}`);
    }
    await logAndReply(answer);
  } catch (error) {
    console.error("[telegram bot webhook] AI Assistant xatosi", error);
    await logAndReply("Javob berishda xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.");
  }

  return new Response("OK");
}
