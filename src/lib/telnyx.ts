// Telnyx Call Control uchun yengil klient — 2026-07-16 (google-oauth.ts) va
// 2026-07-20 (gemini.ts) qarorlariga mos: `telnyx` npm paketi o'rniga
// to'g'ridan-to'g'ri `fetch` bilan REST API chaqiriladi.

import { createPublicKey, verify as edVerify } from "crypto";

const TELNYX_API_BASE = "https://api.telnyx.com/v2";

function getApiKey(): string {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey) {
    throw new Error("TELNYX_API_KEY topilmadi (.env.local ni tekshiring)");
  }
  return apiKey;
}

// Telnyx portalidagi "Public Key" (Ed25519, base64) asosida webhook imzosini
// tekshirish uchun kalit obyekti yaratadi. Node crypto raw Ed25519 kalitni
// to'g'ridan-to'g'ri qabul qilmagani sababli JWK (OKP/Ed25519) shakliga
// o'giriladi.
function getTelnyxPublicKey() {
  const raw = process.env.TELNYX_PUBLIC_KEY;
  if (!raw) {
    throw new Error("TELNYX_PUBLIC_KEY topilmadi (.env.local ni tekshiring)");
  }
  const x = Buffer.from(raw, "base64").toString("base64url");
  return createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x }, format: "jwk" });
}

// Telnyx webhook so'rovi haqiqiyligini tekshiradi: imzo
// `Ed25519(timestamp|raw_body)` ko'rinishida keladi (`telnyx-signature-ed25519`
// va `telnyx-timestamp` headerlari). Muvaffaqiyatsiz bo'lsa (kalit yo'q,
// header yo'q, imzo mos kelmasa) false qaytaradi.
export function verifyTelnyxSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null
): boolean {
  if (!signatureHeader || !timestampHeader) return false;
  try {
    const message = Buffer.from(`${timestampHeader}|${rawBody}`, "utf8");
    const signature = Buffer.from(signatureHeader, "base64");
    return edVerify(null, message, getTelnyxPublicKey(), signature);
  } catch (err) {
    console.error("[telnyx] imzo tekshiruvi xatosi", err);
    return false;
  }
}

async function telnyxCommand(callControlId: string, action: string, body?: unknown) {
  const res = await fetch(`${TELNYX_API_BASE}/calls/${callControlId}/actions/${action}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    console.error("[telnyx] buyruq muvaffaqiyatsiz", {
      action,
      status: res.status,
      text: await res.text(),
    });
  }
  return res;
}

export async function answerCall(callControlId: string) {
  await telnyxCommand(callControlId, "answer");
}

// DIQQAT: Telnyx'ning o'rnatilgan "speak" TTS ovozlari o'zbek tilini
// qo'llab-quvvatlamaydi. Hozircha bu faqat ulanish zanjirini (call control
// webhook -> answer -> speak -> hangup) tekshirish uchun ishlatiladi. Haqiqiy
// o'zbekcha ovozli suhbat (Stage 3) uchun boshqa TTS provayder (masalan
// ElevenLabs) Telnyx Media Streaming orqali ulanishi kerak bo'ladi.
export async function speakCallText(callControlId: string, text: string) {
  await telnyxCommand(callControlId, "speak", {
    payload: text,
    voice: "female",
    language: "en-US",
  });
}

export async function hangupCall(callControlId: string) {
  await telnyxCommand(callControlId, "hangup");
}
