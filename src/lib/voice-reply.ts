// AI Assistant matn javobini ovozga aylantirib, alohida xabar sifatida
// yuboradi. Ovozli xabar ustiga qurilgan suhbatlar uchun ishlatiladi
// (telegram-bot.ts va public-reply.ts dan chaqiriladi).
//
// Ovoz manbai: ElevenLabs orqali egaNING O'Z KLONLANGAN OVOZI ustuvor
// (2026-07-23'da `/mehmon` ovozli suhbat uchun sozlangan, ELEVENLABS_API_KEY/
// ELEVENLABS_VOICE_ID production'da mavjud) — foydalanuvchi aniq shuni so'radi
// ("AI ovozi emas, mening ovozim ulansin"). ElevenLabs sozlanmagan yoki
// so'rov xato bersa, Gemini TTS'ga (umumiy, klonlanmagan ovoz) qaytariladi —
// bu ham xato bersagina chaqiruvchiga `false` qaytarilib, matn fallback'iga
// o'tiladi (2026-07-23'dagi qaror: foydalanuvchi hech qachon butunlay
// javobsiz qolmasligi kerak).

import { InputFile, type Context } from "grammy";
import { synthesizeSpeech } from "./gemini";
import { isElevenLabsConfigured, synthesizeClonedVoice } from "./elevenlabs";

// `true` qaytarsa ovozli javob muvaffaqiyatli yuborilgan; `false` bo'lsa
// chaqiruvchi tomon matn bilan zaxira (fallback) javob berishi kerak —
// aks holda TTS xato bergan holatda foydalanuvchi HECH QANDAY javob
// olmay qoladi.
export async function sendVoiceReply(ctx: Context, text: string): Promise<boolean> {
  if (isElevenLabsConfigured()) {
    try {
      const audio = await synthesizeClonedVoice(text);
      await ctx.replyWithAudio(new InputFile(audio, "javob.mp3"));
      return true;
    } catch (error) {
      console.error("[voice-reply] ElevenLabs TTS xatosi, Gemini TTS'ga o'tildi", error);
    }
  }

  try {
    const audio = await synthesizeSpeech(text);
    await ctx.replyWithAudio(new InputFile(audio, "javob.wav"));
    return true;
  } catch (error) {
    console.error("[voice-reply] TTS xatosi", error);
    return false;
  }
}
