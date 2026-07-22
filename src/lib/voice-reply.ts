// AI Assistant matn javobini ovozga aylantirib, alohida xabar sifatida
// yuboradi. Ovozli xabar ustiga qurilgan suhbatlar uchun ishlatiladi
// (telegram-bot.ts va public-reply.ts dan chaqiriladi).

import { InputFile, type Context } from "grammy";
import { synthesizeSpeech } from "./gemini";

export async function sendVoiceReply(ctx: Context, text: string) {
  try {
    const audio = await synthesizeSpeech(text);
    await ctx.replyWithAudio(new InputFile(audio, "javob.wav"));
  } catch (error) {
    console.error("[voice-reply] TTS xatosi", error);
  }
}
