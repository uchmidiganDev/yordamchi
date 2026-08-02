// ElevenLabs orqali klonlangan ovoz bilan matnni nutqqa aylantirish —
// Gemini TTS'dan farqli o'laroq (faqat tayyor ovozlar), ElevenLabs
// foydalanuvchining o'z ovoz namunasidan yaratilgan klonlangan ovozdan
// (voice_id) foydalanadi. Hisob/API kalit/klonlangan ovoz foydalanuvchi
// tomonidan elevenlabs.io'da qo'lda tayyorlanadi — bu yerda faqat
// so'rovni yuborish mantiqi bor (googleapis/gemini.ts'dagi kabi SDK'siz,
// to'g'ridan-to'g'ri fetch).
//
// Shu faylning pastki qismida "/tel" (AI telefon operatori, 2026-07-31)
// uchun ElevenLabs Conversational AI (agent yaratish/yangilash, telefon
// raqamini agentga biriktirish, qo'ng'iroq audio yozuvini olish, post-call
// webhook imzosini tekshirish) funksiyalari ham bor — bir xil hisob/API
// kalitdan foydalangani uchun alohida faylga chiqarilmadi.

import { createHmac, timingSafeEqual } from "crypto";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

export function isElevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID);
}

export async function synthesizeClonedVoice(text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) {
    throw new Error(
      "ELEVENLABS_API_KEY yoki ELEVENLABS_VOICE_ID topilmadi (.env.local ni tekshiring)"
    );
  }

  const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      // Pastroq stability (0.32) + style (0.35) bilan sinalgan edi — jonli
      // Mini App sinovida so'zlar aniq-tiniq chiqmay, "dona-dona" gapirmasligi
      // (mumbling) aniqlandi. Standart qiymatlarga (stability 0.5,
      // similarity_boost 0.75, style/speed'siz) qaytarilgach eng tiniq va
      // tabiiy natija shu bo'lgani foydalanuvchi tomonidan tasdiqlandi.
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs TTS xatosi (${res.status}): ${body.slice(0, 300)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

// --- Conversational AI: "/tel" telefon operatori agenti ---

function requireApiKey(): string {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY topilmadi (.env.local ni tekshiring)");
  }
  return apiKey;
}

export type PhoneAgentParams = {
  systemPrompt: string;
  firstMessage: string;
  voiceId: string;
};

function phoneAgentBody({ systemPrompt, firstMessage, voiceId }: PhoneAgentParams) {
  return {
    name: "Telefon operatori",
    conversation_config: {
      agent: {
        prompt: { prompt: systemPrompt },
        first_message: firstMessage,
        // ElevenLabs Conversational AI o'zbek tilini ("uz") qo'llab-quvvatlamaydi
        // (agent yaratishda 422 "Language uz is not supported for model
        // eleven_multilingual_v2" xatosi bilan aniqlandi) — bu maydon ASR/turn-taking
        // uchun ishlatiladi, oddiy TTS endpoint (synthesizeClonedVoice) esa til
        // ko'rsatmasidan mustaqil ravishda o'zbekcha matnni allaqachon tabiiy talaffuz
        // bilan aytib berishi tasdiqlangan. "ru" tanlandi — O'zbekistonda deyarli barcha
        // qo'ng'iroq qiluvchilar ruscha ham tushunadi/gapiradi va eleven_multilingual_v2
        // ro'yxatida bor; agar jonli sinovda ASR sifati past chiqsa, "tr" (turkiy til,
        // fonetik jihatdan o'zbekchaga yaqinroq) muqobil sifatida sinash kerak.
        language: "ru",
      },
      tts: {
        voice_id: voiceId,
        model_id: "eleven_multilingual_v2",
        stability: 0.5,
        similarity_boost: 0.75,
      },
    },
  };
}

// Yangi Conversational AI agent yaratadi va uning ID'sini qaytaradi.
export async function createPhoneAgent(params: PhoneAgentParams): Promise<string> {
  const apiKey = requireApiKey();
  const res = await fetch(`${ELEVENLABS_BASE}/convai/agents/create`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(phoneAgentBody(params)),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs agent yaratish xatosi (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as { agent_id: string };
  return data.agent_id;
}

// Mavjud agentning system prompti/ovozini yangilaydi (Bilim baza
// o'zgarganda yoki "/tel" sahifasida "Sinxronlash" bosilganda chaqiriladi).
export async function updatePhoneAgent(
  agentId: string,
  params: PhoneAgentParams
): Promise<void> {
  const apiKey = requireApiKey();
  const res = await fetch(`${ELEVENLABS_BASE}/convai/agents/${agentId}`, {
    method: "PATCH",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(phoneAgentBody(params)),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs agent yangilash xatosi (${res.status}): ${body.slice(0, 300)}`);
  }
}

// Telefon raqamini agentga biriktiradi (agentId berilsa) yoki ajratadi
// (agentId=null) — "/tel" sahifasidagi Yoqish/O'chirish svitchi shu orqali
// ishlaydi ("AI boshqarish ham shu yerda" talabi).
export async function setPhoneNumberAgent(
  phoneNumberId: string,
  agentId: string | null
): Promise<void> {
  const apiKey = requireApiKey();
  const res = await fetch(`${ELEVENLABS_BASE}/convai/phone-numbers/${phoneNumberId}`, {
    method: "PATCH",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ agent_id: agentId }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `ElevenLabs telefon raqamini yangilash xatosi (${res.status}): ${body.slice(0, 300)}`
    );
  }
}

// Qo'ng'iroq tugagach audio yozuvni ElevenLabs'dan to'g'ridan-to'g'ri
// so'rov orqali yuklab oladi — `post_call_audio` webhook'iga ATAYLAB
// ishonilmaydi, chunki uzun qo'ng'iroqlarda base64 audio Vercel serverless
// funksiyasining so'rov hajmi chegarasidan (~4.5MB) oshib ketishi mumkin
// (2026-07-31 qarori). Fonda (`after()`) chaqiriladi, src/lib/phone-agent.ts.
export async function getConversationAudio(
  conversationId: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const apiKey = requireApiKey();
  const res = await fetch(`${ELEVENLABS_BASE}/convai/conversations/${conversationId}/audio`, {
    headers: { "xi-api-key": apiKey },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ElevenLabs audio olish xatosi (${res.status}): ${body.slice(0, 300)}`);
  }
  const mimeType = res.headers.get("content-type") || "audio/mpeg";
  return { buffer: Buffer.from(await res.arrayBuffer()), mimeType };
}

// Post-call webhook imzosini tekshiradi. Header shakli:
// "t=<unix-soniya>,v0=<hex-hmac>"; imzolangan xabar "{t}.{rawBody}",
// HMAC-SHA256(webhook secret) — Telnyx'dagi verifyTelnyxSignature va
// telegram-webapp-auth.ts'dagi HMAC tekshiruviga mos naqsh. 5 daqiqadan
// eski so'rovlar replay himoyasi sifatida rad etiladi.
export function verifyElevenLabsWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader) return false;

  const parts: Record<string, string> = {};
  for (const piece of signatureHeader.split(",")) {
    const [key, value] = piece.split("=");
    if (key && value) parts[key] = value;
  }
  const timestamp = parts.t;
  const signature = parts.v0;
  if (!timestamp || !signature) return false;

  const timestampMs = Number(timestamp) * 1000;
  if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
