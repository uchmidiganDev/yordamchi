// Google Gemini (Generative Language API) bilan to'g'ridan-to'g'ri fetch
// orqali ishlash. `@google/generative-ai` paketi o'rniga oddiy HTTP chaqiruv
// ishlatiladi — google-oauth.ts dagi kabi paket bog'liqligini kamaytirish
// uchun. Chiqish har doim strukturaviy JSON (responseSchema orqali).

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const DEFAULT_TTS_VOICE = "Kore";

// Gemini responseSchema — OpenAPI 3.0 uslubidagi sxema obyekti.
export type GeminiSchema = Record<string, unknown>;

type GeminiResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
  }[];
};

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function generateJson<T>(opts: {
  system?: string;
  prompt: string;
  schema: GeminiSchema;
  temperature?: number;
}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY topilmadi (.env.local ni tekshiring)");
  }
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      ...(opts.system
        ? { systemInstruction: { parts: [{ text: opts.system }] } }
        : {}),
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.4,
        responseMimeType: "application/json",
        responseSchema: opts.schema,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Gemini so'rovi muvaffaqiyatsiz (${res.status}): ${body.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as GeminiResponse;
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
    "";
  if (!text) {
    throw new Error("Gemini bo'sh javob qaytardi");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Gemini javobini JSON sifatida o'qib bo'lmadi");
  }
}

// Oddiy matn javob (JSON schema'siz) — suhbat/chat uslubidagi javoblar uchun.
export async function generateText(opts: {
  system?: string;
  prompt: string;
  temperature?: number;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY topilmadi (.env.local ni tekshiring)");
  }
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      ...(opts.system
        ? { systemInstruction: { parts: [{ text: opts.system }] } }
        : {}),
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig: {
        temperature: opts.temperature ?? 0.5,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Gemini so'rovi muvaffaqiyatsiz (${res.status}): ${body.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as GeminiResponse;
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
    "";
  if (!text) {
    throw new Error("Gemini bo'sh javob qaytardi");
  }
  return text.trim();
}

// Ovozli xabarni (base64 audio) matnga aylantiradi — Gemini'ning ko'p
// modalli audio tushunish qobiliyatidan foydalanadi (alohida STT xizmati
// o'rniga), shu bilan bir xil GEMINI_API_KEY'ni ishlatib qo'shimcha
// bog'liqlik/kalitni oldini oladi. Til (o'zbek/rus/ingliz) avtomatik
// aniqlanadi — Gemini'ga aynan shu tillarda javob berish so'raladi.
export async function transcribeAudio(
  base64Audio: string,
  mimeType: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY topilmadi (.env.local ni tekshiring)");
  }
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64Audio } },
            {
              text: "Ushbu audio yozuvidagi nutqni so'zma-so'z, xatosiz transkripsiya qil. Nutq o'zbek, rus yoki ingliz tilida bo'lishi mumkin — tilni avtomatik anda va shu tilda yoz. Faqat transkripsiya matnini qaytar, boshqa hech qanday izoh yoki formatlash qo'shma.",
            },
          ],
        },
      ],
      generationConfig: { temperature: 0.2 },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Gemini STT so'rovi muvaffaqiyatsiz (${res.status}): ${body.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as GeminiResponse;
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
    "";
  return text.trim();
}

type GeminiAudioResponse = {
  candidates?: {
    content?: {
      parts?: { inlineData?: { data?: string; mimeType?: string } }[];
    };
  }[];
};

// Gemini TTS 16-bit PCM (24kHz, mono) qaytaradi — Telegram va boshqa
// pleyerlar to'g'ridan-to'g'ri PCM'ni o'qiy olmagani sabab standart 44
// baytli WAV sarlavhasi bilan o'raladi (tashqi audio kutubxona/ffmpeg
// qo'shmasdan).
function pcmToWav(
  pcm: Buffer,
  sampleRate = 24000,
  channels = 1,
  bitDepth = 16
): Buffer {
  const byteRate = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// Matnni ovozga aylantiradi (Gemini TTS, `responseModalities: ["AUDIO"]`).
// DIQQAT: Gemini TTS rasmiy ravishda o'zbek tilini qo'llab-quvvatlamaydi
// (faqat rus/ingliz kabi 90+ til rasmiy ro'yxatda) — o'zbekcha matn uchun
// natija talaffuzi aniq bo'lmasligi mumkin, lekin so'rov xato qaytarmaydi.
export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY topilmadi (.env.local ni tekshiring)");
  }
  const model = process.env.GEMINI_TTS_MODEL || DEFAULT_TTS_MODEL;
  const voiceName = process.env.GEMINI_TTS_VOICE || DEFAULT_TTS_VOICE;

  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Gemini TTS so'rovi muvaffaqiyatsiz (${res.status}): ${body.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as GeminiAudioResponse;
  const base64Pcm = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Pcm) {
    throw new Error("Gemini TTS audio qaytarmadi");
  }

  return pcmToWav(Buffer.from(base64Pcm, "base64"));
}
