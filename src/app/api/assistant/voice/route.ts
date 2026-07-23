import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { miniAppMessages, users } from "@/db/schema";
import { answerAssistantQuestion, type ConversationTurn } from "@/lib/assistant";
import { verifyTelegramWebAppInitData } from "@/lib/telegram-webapp-auth";
import { transcribeAudio } from "@/lib/gemini";
import { isElevenLabsConfigured, synthesizeClonedVoice } from "@/lib/elevenlabs";

export const maxDuration = 60;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_TELEGRAM_ID = process.env.ALLOWED_TELEGRAM_ID;

const FALLBACK_NO_SPEECH =
  "Kechirasiz, ovozni tushuna olmadim. Iltimos, qayta urinib ko'ring.";

// Mini App'dagi "yuzma-yuz" ovozli suhbat (src/app/mehmon/voice-modal.tsx):
// brauzerda yozilgan ovoz Gemini STT bilan matnga aylantiriladi, AI Assistant
// javob beradi, javob esa klonlangan ovozda (ElevenLabs) nutqqa aylantiriladi.
// /api/assistant/guest'dagi bilan bir xil ochiq (egalik tekshirilmaydigan)
// initData tekshiruvi qo'llanilgan — istalgan Telegram foydalanuvchisi
// gaplasha oladi.
export async function POST(req: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN || !ALLOWED_TELEGRAM_ID) {
    return NextResponse.json(
      { ok: false, error: "server_misconfigured" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const initData = body?.initData;
  const audioBase64Input = body?.audioBase64;
  const audioMimeType =
    typeof body?.audioMimeType === "string" ? body.audioMimeType : "audio/webm";
  const history: ConversationTurn[] = Array.isArray(body?.history) ? body.history : [];

  if (typeof initData !== "string" || !initData) {
    return NextResponse.json(
      { ok: false, error: "missing_init_data" },
      { status: 400 }
    );
  }
  if (typeof audioBase64Input !== "string" || !audioBase64Input) {
    return NextResponse.json({ ok: false, error: "missing_audio" }, { status: 400 });
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

  let transcript = "";
  try {
    transcript = await transcribeAudio(audioBase64Input, audioMimeType);
  } catch (error) {
    console.error("[assistant/voice] transkripsiya xatosi", error);
  }

  if (!transcript.trim()) {
    const audio = await trySynthesize(FALLBACK_NO_SPEECH);
    return NextResponse.json({
      ok: true,
      transcript: "",
      answer: FALLBACK_NO_SPEECH,
      audioBase64: audio,
      audioMimeType: audio ? "audio/mpeg" : null,
    });
  }

  try {
    const answer = await answerAssistantQuestion(owner.id, transcript, history, senderName);

    await db.insert(miniAppMessages).values({
      userId: owner.id,
      chatId: BigInt(tgUser.id),
      fromName: senderName,
      fromUsername: tgUser.username,
      text: transcript,
      answer,
    });

    const audio = await trySynthesize(answer);

    return NextResponse.json({
      ok: true,
      transcript,
      answer,
      audioBase64: audio,
      audioMimeType: audio ? "audio/mpeg" : null,
    });
  } catch (error) {
    console.error("[assistant/voice] xato", error);
    return NextResponse.json({ ok: false, error: "assistant_error" }, { status: 500 });
  }
}

// ElevenLabs sozlanmagan bo'lsa `null` qaytaradi — chaqiruvchi (frontend)
// bunday holda brauzerning o'z SpeechSynthesis'iga zaxira sifatida o'tadi.
async function trySynthesize(text: string): Promise<string | null> {
  if (!isElevenLabsConfigured()) return null;
  try {
    const buffer = await synthesizeClonedVoice(text);
    return buffer.toString("base64");
  } catch (error) {
    console.error("[assistant/voice] ElevenLabs TTS xatosi", error);
    return null;
  }
}
