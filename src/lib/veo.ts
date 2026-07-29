// Google Veo (video generatsiya) bilan to'g'ridan-to'g'ri fetch orqali
// ishlash — gemini.ts/elevenlabs.ts'dagi kabi SDK'siz, oddiy HTTP chaqiruv.
// Veo'ning boshqa Gemini chaqiruvlaridan farqi: bu SINXRON emas — submit
// qilingandan keyin (`predictLongRunning`) operatsiya nomi qaytadi, natija
// esa alohida so'rov (`operations.get`) bilan tayyor bo'lguncha so'raladi.

const GEMINI_API_ROOT = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_VEO_MODEL = "veo-3.1-fast-generate-preview";

function getApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY topilmadi (.env.local ni tekshiring)");
  }
  return apiKey;
}

// Foydalanuvchining erkin (o'zbekcha, so'zlashuv uslubidagi) ko'rsatmasini
// Veo prompt'iga o'raydi — rasmdagi odam asosida video, gapirish kerak
// bo'lsa tabiiy lab-sinxron bilan. BIRINCHI URINISH sifatida yozilgan —
// sifat live sinovda tekshirilib, kerak bo'lsa keyinroq aniqlashtiriladi.
function buildVeoPrompt(instruction: string): string {
  return (
    `Rasmda ko'ringan odam asosida qisqa video yarat. Ko'rsatma: ${instruction}. ` +
    `Agar ko'rsatmada odam biror gap aytishi ko'zda tutilgan bo'lsa, aynan shu ` +
    `so'zlarni tabiiy ohang va aniq lab-sinxron bilan aytsin. Fon va muhit ` +
    `rasmdagi kabi saqlansin.`
  );
}

// Veo submit (predictLongRunning) tez-tez 503 (UNAVAILABLE, "high demand")
// qaytarishi mumkin — generateImage()dagi bilan bir xil bitta marta qisqa
// kutib qayta urinish naqshi.
const SUBMIT_MAX_ATTEMPTS = 2;
const SUBMIT_RETRY_DELAY_MS = 1000;
const SUBMIT_ATTEMPT_TIMEOUT_MS = 20_000;

export async function submitVideoJob(
  instruction: string,
  imageBase64: string,
  imageMimeType: string
): Promise<string> {
  const apiKey = getApiKey();
  const model = process.env.GEMINI_VEO_MODEL || DEFAULT_VEO_MODEL;
  const requestBody = JSON.stringify({
    instances: [
      {
        prompt: buildVeoPrompt(instruction),
        image: {
          bytesBase64Encoded: imageBase64,
          mimeType: imageMimeType,
        },
      },
    ],
    parameters: {
      aspectRatio: "9:16",
      resolution: "720p",
      durationSeconds: 8,
      personGeneration: "allow_adult",
    },
  });

  for (let attempt = 1; attempt <= SUBMIT_MAX_ATTEMPTS; attempt++) {
    const timeoutController = new AbortController();
    const timeout = setTimeout(
      () => timeoutController.abort(),
      SUBMIT_ATTEMPT_TIMEOUT_MS
    );

    let res: Response;
    try {
      res = await fetch(`${GEMINI_API_ROOT}/models/${model}:predictLongRunning`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: requestBody,
        signal: timeoutController.signal,
      });
    } catch (error) {
      const isTimeout = error instanceof Error && error.name === "AbortError";
      if (isTimeout && attempt < SUBMIT_MAX_ATTEMPTS) continue;
      throw isTimeout
        ? new Error("Veo so'rovi vaqt chegarasidan oshib ketdi (juda band)")
        : error;
    } finally {
      clearTimeout(timeout);
    }

    if (res.ok) {
      const data = (await res.json()) as { name?: string };
      if (!data.name) throw new Error("Veo operatsiya nomi qaytmadi");
      return data.name;
    }

    const body = await res.text().catch(() => "");
    if (res.status === 503 && attempt < SUBMIT_MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, SUBMIT_RETRY_DELAY_MS));
      continue;
    }
    throw new Error(
      `Veo so'rovi muvaffaqiyatsiz (${res.status}): ${body.slice(0, 300)}`
    );
  }

  throw new Error("Veo video topshirig'i yuborilmadi");
}

type VeoOperationResponse = {
  name: string;
  done?: boolean;
  response?: {
    generateVideoResponse?: {
      generatedSamples?: { video?: { uri?: string } }[];
      // Google'ning Responsible AI filtri natijani bloklasa (masalan
      // rasmdagi odamni ma'lum so'zlarni aytayotgan qilib ko'rsatish
      // xavfli/firibgarlik kontenti sifatida belgilansa), `generatedSamples`
      // umuman kelmaydi — buning o'rniga shu maydonlar keladi. Jonli
      // sinovda aniqlandi: bunday holatda pul YECHILMAYDI.
      raiMediaFilteredCount?: number;
      raiMediaFilteredReasons?: string[];
    };
  };
  error?: { code?: number; message?: string };
};

export type VeoJobResult = { videoUri: string } | { error: string };

const POLL_INTERVAL_MS = 5_000;

// `deadlineMs` — shu vaqt ichida `done: true` kelmasa, "kechikyapti" xatosi
// bilan to'xtaydi (qattiq kafolat emas — Vercel funksiya muddatidan ("after()"
// ichida) past bo'lishi kerak, xavfsizlik zaxirasi bilan).
export async function waitForVideoJob(
  operationName: string,
  deadlineMs: number
): Promise<VeoJobResult> {
  const apiKey = getApiKey();
  const start = Date.now();

  while (Date.now() - start < deadlineMs) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    let res: Response;
    try {
      res = await fetch(`${GEMINI_API_ROOT}/${operationName}`, {
        headers: { "x-goog-api-key": apiKey },
      });
    } catch {
      continue;
    }

    if (!res.ok) continue;

    const data = (await res.json()) as VeoOperationResponse;
    if (!data.done) continue;

    if (data.error) {
      return { error: data.error.message ?? "Veo video generatsiyasi xato berdi" };
    }
    const generateVideoResponse = data.response?.generateVideoResponse;
    const uri = generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
    if (!uri) {
      const filterReason = generateVideoResponse?.raiMediaFilteredReasons?.[0];
      return { error: filterReason ?? "Veo video URI qaytarmadi" };
    }
    return { videoUri: uri };
  }

  return { error: "Veo video generatsiyasi vaqt chegarasidan oshib ketdi" };
}

// Telegram bot API'ning fayl yuklash chegarasi (~50MB) — xavfsizlik zaxirasi
// bilan (video-downloader.ts'dagi bilan bir xil taxmin).
const MAX_VIDEO_BYTES = 45 * 1024 * 1024;

export async function downloadVideoBytes(videoUri: string): Promise<Buffer> {
  const apiKey = getApiKey();
  const res = await fetch(videoUri, {
    headers: { "x-goog-api-key": apiKey },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Veo video yuklab olinmadi (${res.status}): ${body.slice(0, 300)}`
    );
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_VIDEO_BYTES) {
    throw new Error("Veo video hajmi Telegram chegarasidan katta");
  }
  return buffer;
}
