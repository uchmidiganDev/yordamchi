// Google Gemini (Generative Language API) bilan to'g'ridan-to'g'ri fetch
// orqali ishlash. `@google/generative-ai` paketi o'rniga oddiy HTTP chaqiruv
// ishlatiladi — google-oauth.ts dagi kabi paket bog'liqligini kamaytirish
// uchun. Chiqish har doim strukturaviy JSON (responseSchema orqali).

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";

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
