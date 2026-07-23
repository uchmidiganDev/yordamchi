// ElevenLabs orqali klonlangan ovoz bilan matnni nutqqa aylantirish —
// Gemini TTS'dan farqli o'laroq (faqat tayyor ovozlar), ElevenLabs
// foydalanuvchining o'z ovoz namunasidan yaratilgan klonlangan ovozdan
// (voice_id) foydalanadi. Hisob/API kalit/klonlangan ovoz foydalanuvchi
// tomonidan elevenlabs.io'da qo'lda tayyorlanadi — bu yerda faqat
// so'rovni yuborish mantiqi bor (googleapis/gemini.ts'dagi kabi SDK'siz,
// to'g'ridan-to'g'ri fetch).

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
