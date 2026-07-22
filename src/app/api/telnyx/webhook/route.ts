import { eq } from "drizzle-orm";
import { db } from "@/db";
import { aiPersonas, users } from "@/db/schema";
import { answerCall, hangupCall, speakCallText, verifyTelnyxSignature } from "@/lib/telnyx";

const ALLOWED_TELEGRAM_ID = process.env.ALLOWED_TELEGRAM_ID;

// Ilova bitta egasi (single-tenant) uchun ishlaydi — src/lib/telegram-bot.ts
// dagi getOwnerUser() bilan bir xil naqsh: ALLOWED_TELEGRAM_ID orqali yagona
// foydalanuvchi yozuvi topiladi (webhook kontekstida sessiya/cookie yo'q).
async function getOwnerPhoneState() {
  if (!ALLOWED_TELEGRAM_ID) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, BigInt(ALLOWED_TELEGRAM_ID)))
    .limit(1);
  if (!user) return null;

  let personaName = "AI yordamchi";
  if (user.activePersonaId) {
    const [persona] = await db
      .select({ name: aiPersonas.name })
      .from(aiPersonas)
      .where(eq(aiPersonas.id, user.activePersonaId))
      .limit(1);
    if (persona) personaName = persona.name;
  }

  return { phoneAiEnabled: user.phoneAiEnabled, personaName };
}

// Stage 2 skeleti: qo'ng'iroq keladi -> javob beriladi -> ulanish
// tekshiruvi sifatida qisqa xabar TTS orqali aytiladi -> qo'ng'iroq
// tugatiladi. Haqiqiy STT->AI->TTS suhbat oqimi Stage 3'da shu route ichiga
// (yoki Media Streaming WebSocket handleriga) qo'shiladi.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("telnyx-signature-ed25519");
  const timestamp = req.headers.get("telnyx-timestamp");

  if (!verifyTelnyxSignature(rawBody, signature, timestamp)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const eventType: string | undefined = event?.data?.event_type;
  const payload = event?.data?.payload ?? {};
  const callControlId: string | undefined = payload.call_control_id;

  console.log("[telnyx-webhook] hodisa", {
    eventType,
    callControlId,
    direction: payload.direction,
  });

  if (!callControlId) {
    return new Response("ok");
  }

  switch (eventType) {
    case "call.initiated": {
      if (payload.direction === "incoming") {
        await answerCall(callControlId);
      }
      break;
    }
    case "call.answered": {
      const state = await getOwnerPhoneState();
      const text = state?.phoneAiEnabled
        ? `Hello, this is a test connection for ${state.personaName}, an AI phone assistant. The full conversation feature is coming soon. Goodbye.`
        : "Hello. The owner is currently unavailable. Message recording is coming soon. Goodbye.";
      await speakCallText(callControlId, text);
      break;
    }
    case "call.speak.ended": {
      await hangupCall(callControlId);
      break;
    }
    default:
      break;
  }

  return new Response("ok");
}
