// Google Gemini (Generative Language API) bilan to'g'ridan-to'g'ri fetch
// orqali ishlash. `@google/generative-ai` paketi o'rniga oddiy HTTP chaqiruv
// ishlatiladi — google-oauth.ts dagi kabi paket bog'liqligini kamaytirish
// uchun. Chiqish har doim strukturaviy JSON (responseSchema orqali).

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const DEFAULT_TTS_VOICE = "Kore";
const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image";

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

type GeminiGroundedResponse = {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    groundingMetadata?: {
      groundingChunks?: { web?: { uri?: string; title?: string } }[];
    };
  }[];
};

export type SearchResult = {
  answer: string;
  videoUrl: string | null;
  sources: { title: string; uri: string }[];
};

// "/search" buyrug'i uchun — Gemini'ning `google_search` grounding tool'i
// orqali haqiqiy internet qidiruviga asoslangan javob beradi (o'zining
// ichki bilimidan emas). Video: grounding manbalari orasidan YouTube
// havolasi qidiriladi; topilmasa, oddiy YouTube qidiruv havolasi
// (video yuklab olish emas, faqat qidiruv sahifasiga link) fallback
// sifatida qaytariladi — bu 2026-07-23'dagi video-yuklab-berish
// investigatsiyasi (YouTube/Instagram bloklanishi) bilan izchil: bu
// yerda video FAYLINI yuklamaymiz, faqat havola beramiz.
export async function searchWeb(query: string): Promise<SearchResult> {
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
            {
              text: `Quyidagi mavzu haqida internetdan qidirib, aniq va foydali ma'lumot ber (o'zbek tilida, 4-8 gap): "${query}"`,
            },
          ],
        },
      ],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.4 },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Gemini qidiruv so'rovi muvaffaqiyatsiz (${res.status}): ${body.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as GeminiGroundedResponse;
  const answer =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
  if (!answer) {
    throw new Error("Gemini qidiruvdan javob qaytarmadi");
  }

  const chunks = data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources = chunks
    .map((c) => c.web)
    .filter((w): w is { uri: string; title?: string } => Boolean(w?.uri))
    .map((w) => ({ uri: w.uri, title: w.title || w.uri }));

  // `uri` har doim vertexaisearch.cloud.google.com orqali qayta yo'naltirish
  // havolasi (haqiqiy manzil emas) — haqiqiy domen faqat `title`da ko'rinadi
  // (masalan "youtube.com"). Jonli sinovda aniqlandi: grounding video so'rov
  // uchun ham deyarli har doim matn/blog manbalarini qaytaradi, YouTube
  // kamdan-kam chiqadi — shu sabab aksariyat holatda pastdagi oddiy YouTube
  // qidiruv havolasi (video FAYLI emas, faqat qidiruv sahifasi) ishlatiladi.
  const videoSource = sources.find((s) => /youtube\.com|youtu\.be/i.test(s.title));
  const videoUrl =
    videoSource?.uri ??
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  return {
    answer,
    videoUrl,
    sources: sources.filter((s) => s.uri !== videoSource?.uri).slice(0, 3),
  };
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

// Matn tavsifi asosida rasm generatsiya qiladi (`/img` buyrug'i uchun).
// `responseModalities` ["TEXT","IMAGE"] bo'lishi shart — ba'zi Gemini
// rasm modellari faqat IMAGE bilan so'ralganda xato qaytaradi; javobdagi
// qism(lar)dan birinchi inlineData bor bo'lagi rasm sifatida olinadi
// (modelning matn izohi bo'lishi mumkin bo'lgan qismlari e'tiborsiz
// qoldiriladi).
export type GeneratedImage = { buffer: Buffer; mimeType: string };

// Rasm modeli tez-tez 503 (UNAVAILABLE, "high demand") qaytaradi — jonli
// sinovda bir xil so'rov birinchi safar 503, darhol keyingi urinishda 200
// qaytardi. Shu sabab 503'da bitta marta qisqa kutib qayta urinib ko'ramiz;
// boshqa xatolarda (masalan 429 kvota) darhol tashlaymiz.
const IMAGE_MAX_ATTEMPTS = 2;
const IMAGE_RETRY_DELAY_MS = 3000;

export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY topilmadi (.env.local ni tekshiring)");
  }
  const model = process.env.GEMINI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
  const requestBody = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  for (let attempt = 1; attempt <= IMAGE_MAX_ATTEMPTS; attempt++) {
    const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: requestBody,
    });

    if (res.ok) {
      const data = (await res.json()) as GeminiAudioResponse;
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const imagePart = parts.find((p) => p.inlineData?.data)?.inlineData;
      if (!imagePart?.data) {
        throw new Error("Gemini rasm qaytarmadi");
      }
      return {
        buffer: Buffer.from(imagePart.data, "base64"),
        mimeType: imagePart.mimeType || "image/png",
      };
    }

    const body = await res.text().catch(() => "");
    if (res.status === 503 && attempt < IMAGE_MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, IMAGE_RETRY_DELAY_MS));
      continue;
    }
    throw new Error(
      `Gemini rasm so'rovi muvaffaqiyatsiz (${res.status}): ${body.slice(0, 300)}`
    );
  }

  throw new Error("Gemini rasm generatsiya qilinmadi");
}

// Telegram Bot API'ning oddiy fayl yuklash chegarasi (~20MB) — inline
// base64 so'rov hajmini oqilona darajada ushlab turish uchun ham mos
// zaxira sifatida ishlatiladi.
const MAX_PDF_BYTES = 20 * 1024 * 1024;

export type PdfEditPlan = {
  pageNumbers: number[];
  newText: string;
  summary: string;
};

// "/pdf" oqimi uchun — PDF hujjatni Gemini'ning ko'p modalli hujjat
// tushunish qobiliyati orqali (audio/rasm kabi inlineData, mimeType
// "application/pdf") to'g'ridan-to'g'ri o'qib, ko'rsatma ASOSAN qaysi
// original sahifa(lar)ga tegishli ekanini va o'sha sahifa(lar) o'rnini
// bosadigan TO'LIQ matnni aniqlaydi. Butun hujjatni qayta yozish O'RNIGA
// (avvalgi versiyaning kamchiligi — bu hujjat dizaynini butunlay buzardi,
// foydalanuvchi shikoyat qildi) faqat tegishli sahifalar
// `applyPdfEdit()` (src/lib/pdf-generator.ts) orqali almashtiriladi,
// qolgan sahifalar asl holicha saqlanadi.
export async function planPdfEdit(
  base64Pdf: string,
  instruction: string
): Promise<PdfEditPlan> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY topilmadi (.env.local ni tekshiring)");
  }
  if (Buffer.byteLength(base64Pdf, "base64") > MAX_PDF_BYTES) {
    throw new Error("PDF hajmi juda katta (20MB dan oshadi)");
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
            { inlineData: { mimeType: "application/pdf", data: base64Pdf } },
            {
              text: `Foydalanuvchi ushbu PDF hujjatga quyidagi ko'rsatmani berdi: "${instruction}".

VAZIFANG:
1) Ko'rsatma hujjatning qaysi ASL sahifa(lar)iga tegishli ekanini aniqla (1 dan boshlab raqamlangan sahifa raqamlari).
2) O'sha sahifa(lar) o'rnini bosadigan TO'LIQ va TAYYOR matnni yoz — bu matnda FAQAT so'ralgan o'zgarish qo'llanilgan bo'lsin, o'sha sahifa(lar)dagi QOLGAN barcha kontent so'zma-so'z ASLIGA MOS saqlansin. Butun hujjatni qayta yozma yoki qayta formatlama — faqat ko'rsatma tegishli bo'lgan qism(lar)ni o'zgartir.
3) Nima o'zgartirilganini foydalanuvchiga bir qisqa jumlada tushuntir.`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            pageNumbers: { type: "array", items: { type: "integer" } },
            newText: { type: "string" },
            summary: { type: "string" },
          },
          required: ["pageNumbers", "newText", "summary"],
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Gemini PDF so'rovi muvaffaqiyatsiz (${res.status}): ${body.slice(0, 300)}`
    );
  }

  const data = (await res.json()) as GeminiResponse;
  const text =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
  if (!text) {
    throw new Error("Gemini PDF uchun javob qaytarmadi");
  }

  try {
    return JSON.parse(text) as PdfEditPlan;
  } catch {
    throw new Error("Gemini PDF javobini o'qib bo'lmadi");
  }
}
