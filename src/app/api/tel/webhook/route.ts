import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { phoneCalls, users } from "@/db/schema";
import { verifyElevenLabsWebhookSignature } from "@/lib/elevenlabs";
import { fetchAndStoreCallRecording, parseCallerNumber, parseCalleeNumber } from "@/lib/phone-agent";

const ALLOWED_TELEGRAM_ID = process.env.ALLOWED_TELEGRAM_ID;

// Ilova bitta egasi (single-tenant) uchun ishlaydi — src/app/api/telnyx/webhook
// dagi getOwnerPhoneState() bilan bir xil naqsh: webhook kontekstida
// sessiya/cookie yo'q, ALLOWED_TELEGRAM_ID orqali yagona foydalanuvchi topiladi.
async function getOwnerUserId(): Promise<string | null> {
  if (!ALLOWED_TELEGRAM_ID) return null;
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.telegramId, BigInt(ALLOWED_TELEGRAM_ID)))
    .limit(1);
  return user?.id ?? null;
}

type TranscriptTurn = {
  role?: string;
  message?: string;
  time_in_call_secs?: number;
};

// ElevenLabs post-call webhook'i — faqat `post_call_transcription` turi
// qabul qilinadi (`post_call_audio` ATAYLAB ro'yxatdan o'tkazilmaydi,
// src/lib/elevenlabs.ts'dagi getConversationAudio() izohiga qarang).
export async function POST(req: Request) {
  const rawBody = await req.text();
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[tel-webhook] ELEVENLABS_WEBHOOK_SECRET sozlanmagan");
    return new Response("Server sozlamasi to'liq emas", { status: 500 });
  }

  const signature = req.headers.get("elevenlabs-signature");
  if (!verifyElevenLabsWebhookSignature(rawBody, signature, secret)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const event = JSON.parse(rawBody);
  if (event?.type !== "post_call_transcription") {
    return new Response("ok");
  }

  const data = event.data ?? {};
  const conversationId: string | undefined = data.conversation_id;
  if (!conversationId) {
    return new Response("ok");
  }

  const userId = await getOwnerUserId();
  if (!userId) {
    console.error("[tel-webhook] egasi topilmadi (ALLOWED_TELEGRAM_ID)");
    return new Response("ok");
  }

  const transcript: TranscriptTurn[] = Array.isArray(data.transcript) ? data.transcript : [];
  const transcriptJson = JSON.stringify(
    transcript.map((t) => ({
      role: t.role ?? "unknown",
      message: t.message ?? "",
      timeInCallSecs: t.time_in_call_secs ?? null,
    }))
  );

  const startedAtUnix = data.metadata?.start_time_unix_secs;
  const startedAt =
    typeof startedAtUnix === "number" ? new Date(startedAtUnix * 1000) : new Date();
  const durationSeconds =
    typeof data.metadata?.call_duration_secs === "number"
      ? data.metadata.call_duration_secs
      : null;
  const summary =
    typeof data.analysis?.transcript_summary === "string"
      ? data.analysis.transcript_summary
      : null;
  const status = typeof data.analysis?.call_successful === "string"
    ? data.analysis.call_successful
    : "completed";

  const values = {
    userId,
    conversationId,
    callerNumber: parseCallerNumber(data),
    calleeNumber: parseCalleeNumber(data),
    status,
    startedAt,
    durationSeconds,
    transcriptJson,
    summary,
    rawPayload: JSON.stringify(data).slice(0, 50_000),
  };

  await db
    .insert(phoneCalls)
    .values(values)
    .onConflictDoUpdate({ target: phoneCalls.conversationId, set: values });

  after(() => fetchAndStoreCallRecording(conversationId));

  return new Response("ok");
}
