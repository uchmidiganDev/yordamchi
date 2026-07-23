import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { miniAppMessages, users } from "@/db/schema";
import { answerAssistantQuestion, type ConversationTurn } from "@/lib/assistant";
import { verifyTelegramWebAppInitData } from "@/lib/telegram-webapp-auth";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_TELEGRAM_ID = process.env.ALLOWED_TELEGRAM_ID;

// Mini App'ni ochgan har qanday (egasi bo'lmagan) Telegram foydalanuvchisi
// bilan AI Assistant suhbati (`src/app/mehmon/page.tsx`dan chaqiriladi).
// `initData` imzosi tekshiriladi (haqiqiy Telegram foydalanuvchisi ekanini
// tasdiqlash uchun), lekin ALLOWED_TELEGRAM_ID bilan solishtirilMAYDI — bu
// yerga istalgan Telegram foydalanuvchisi kirishi mumkin. Admin oqimi bundan
// butunlay alohida (`/api/auth/telegram/webapp`).
export async function POST(req: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN || !ALLOWED_TELEGRAM_ID) {
    return NextResponse.json(
      { ok: false, error: "server_misconfigured" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const initData = body?.initData;
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const history: ConversationTurn[] = Array.isArray(body?.history) ? body.history : [];

  if (typeof initData !== "string" || !initData) {
    return NextResponse.json(
      { ok: false, error: "missing_init_data" },
      { status: 400 }
    );
  }
  if (!question) {
    return NextResponse.json({ ok: false, error: "missing_question" }, { status: 400 });
  }

  const tgUser = verifyTelegramWebAppInitData(initData, TELEGRAM_BOT_TOKEN);
  if (!tgUser) {
    return NextResponse.json(
      { ok: false, error: "invalid_init_data" },
      { status: 401 }
    );
  }

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.telegramId, BigInt(ALLOWED_TELEGRAM_ID)))
    .limit(1);
  if (!owner) {
    return NextResponse.json({ ok: false, error: "owner_not_found" }, { status: 500 });
  }

  const senderName =
    [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ") ||
    tgUser.username ||
    null;

  try {
    const answer = await answerAssistantQuestion(owner.id, question, history, senderName);

    await db.insert(miniAppMessages).values({
      userId: owner.id,
      chatId: BigInt(tgUser.id),
      fromName: senderName,
      fromUsername: tgUser.username,
      text: question,
      answer,
    });

    return NextResponse.json({ ok: true, answer });
  } catch (error) {
    console.error("[assistant/guest] xato", error);
    return NextResponse.json({ ok: false, error: "assistant_error" }, { status: 500 });
  }
}
