"use server";

// "/tel" sahifasi — ElevenLabs Conversational AI asosidagi haqiqiy telefon
// operatori: agent yaratish/sinxronlash, telefon raqamini yoqish/o'chirish
// va qo'ng'iroqlar jurnalini ko'rsatish uchun server action'lar.

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { phoneCalls, users } from "@/db/schema";
import { setPhoneNumberAgent } from "@/lib/elevenlabs";
import { syncPhoneAgent } from "@/lib/phone-agent";
import { requireUserId } from "./require-user";

export type TelStatus = {
  agentId: string | null;
  phoneNumberId: string | null;
  phoneNumberE164: string | null;
  enabled: boolean;
};

export async function getTelStatus(): Promise<TelStatus> {
  const userId = await requireUserId();
  const [row] = await db
    .select({
      phoneAgentId: users.phoneAgentId,
      phoneNumberId: users.phoneNumberId,
      phoneNumberE164: users.phoneNumberE164,
      phoneAiEnabled: users.phoneAiEnabled,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return {
    agentId: row?.phoneAgentId ?? null,
    phoneNumberId: row?.phoneNumberId ?? null,
    phoneNumberE164: row?.phoneNumberE164 ?? null,
    enabled: row?.phoneAiEnabled ?? false,
  };
}

type ActionResult = { ok: true } | { ok: false; error: string };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Noma'lum xato";
}

// "Sinxronlash" tugmasi — agent yo'q bo'lsa yaratadi, bor bo'lsa bilim
// bazasi/system prompt asosida yangilaydi. AI yoqiq bo'lsa ham, o'chiq
// bo'lsa ham ishlaydi (keyingi safar yoqilganda yangi kontent ishlatiladi).
export async function syncAgentAction(): Promise<ActionResult> {
  const userId = await requireUserId();
  try {
    await syncPhoneAgent(userId);
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath("/tel");
  return { ok: true };
}

export async function setPhoneNumber(
  phoneNumberId: string,
  phoneNumberE164: string
): Promise<ActionResult> {
  const userId = await requireUserId();
  const trimmedId = phoneNumberId.trim();
  if (!trimmedId) {
    return { ok: false, error: "ElevenLabs telefon raqami ID si kiritilishi shart" };
  }

  await db
    .update(users)
    .set({ phoneNumberId: trimmedId, phoneNumberE164: phoneNumberE164.trim() || null })
    .where(eq(users.id, userId));
  revalidatePath("/tel");
  return { ok: true };
}

// AI Yoqish/O'chirish svitchi — ElevenLabs'da telefon raqamiga agentni
// biriktiradi (yoqilganda, avval sinxronlab so'ng) yoki ajratadi (o'chirilganda).
export async function setPhoneAiEnabled(enabled: boolean): Promise<ActionResult> {
  const userId = await requireUserId();
  const [row] = await db
    .select({ phoneNumberId: users.phoneNumberId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!row?.phoneNumberId) {
    return { ok: false, error: "Avval ElevenLabs telefon raqami ID sini kiriting" };
  }

  try {
    if (enabled) {
      const agentId = await syncPhoneAgent(userId);
      await setPhoneNumberAgent(row.phoneNumberId, agentId);
    } else {
      await setPhoneNumberAgent(row.phoneNumberId, null);
    }
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }

  await db.update(users).set({ phoneAiEnabled: enabled }).where(eq(users.id, userId));
  revalidatePath("/tel");
  return { ok: true };
}

export type PhoneCallTranscriptTurn = {
  role: string;
  message: string;
  timeInCallSecs: number | null;
};

export type PhoneCallView = {
  id: string;
  callerNumber: string | null;
  status: string;
  startedAtISO: string | null;
  durationSeconds: number | null;
  summary: string | null;
  transcript: PhoneCallTranscriptTurn[];
  hasRecording: boolean;
};

export async function listPhoneCalls(): Promise<PhoneCallView[]> {
  const userId = await requireUserId();
  const rows = await db
    .select({
      id: phoneCalls.id,
      callerNumber: phoneCalls.callerNumber,
      status: phoneCalls.status,
      startedAt: phoneCalls.startedAt,
      durationSeconds: phoneCalls.durationSeconds,
      summary: phoneCalls.summary,
      transcriptJson: phoneCalls.transcriptJson,
      recordingMimeType: phoneCalls.recordingMimeType,
    })
    .from(phoneCalls)
    .where(eq(phoneCalls.userId, userId))
    .orderBy(desc(phoneCalls.createdAt))
    .limit(50);

  return rows.map((r) => ({
    id: r.id,
    callerNumber: r.callerNumber,
    status: r.status,
    startedAtISO: r.startedAt ? r.startedAt.toISOString() : null,
    durationSeconds: r.durationSeconds,
    summary: r.summary,
    transcript: r.transcriptJson ? JSON.parse(r.transcriptJson) : [],
    hasRecording: Boolean(r.recordingMimeType),
  }));
}
