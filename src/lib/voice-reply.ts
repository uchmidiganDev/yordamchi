// AI Assistant matn javobini ovozga aylantirib, alohida xabar sifatida
// yuboradi. Ovozli xabar ustiga qurilgan suhbatlar uchun ishlatiladi
// (telegram-bot.ts va public-reply.ts dan chaqiriladi).

import { InputFile, type Context } from "grammy";
import { synthesizeSpeech } from "./gemini";

// `true` qaytarsa ovozli javob muvaffaqiyatli yuborilgan; `false` bo'lsa
// chaqiruvchi tomon matn bilan zaxira (fallback) javob berishi kerak —
// aks holda TTS xato bergan holatda foydalanuvchi HECH QANDAY javob
// olmay qoladi.
export async function sendVoiceReply(ctx: Context, text: string): Promise<boolean> {
  try {
    const audio = await synthesizeSpeech(text);
    await ctx.replyWithAudio(new InputFile(audio, "javob.wav"));
    return true;
  } catch (error) {
    console.error("[voice-reply] TTS xatosi", error);
    return false;
  }
}
