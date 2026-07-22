"use server";

// "/shaxsiy-ai" sahifasi — Telegram Business orqali shaxsiy akkauntga
// kelgan xabarlarda qo'shimcha imkoniyatlarni (ovozli javob, link tahlili,
// video yuklab berish) yoqish/o'chirish. Business ulanishning o'zi
// Telegram sozlamalaridan amalga oshiriladi (mavjud /telegram sahifasida
// ko'rsatiladi); bu yerda faqat imkoniyatlar boshqariladi.

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUserId } from "./require-user";

export type ShaxsiyAiSettings = {
  businessConnected: boolean;
  voiceReplyEnabled: boolean;
  linkAnalysisEnabled: boolean;
  videoDownloadEnabled: boolean;
};

export async function getShaxsiyAiSettings(): Promise<ShaxsiyAiSettings> {
  const userId = await requireUserId();
  const [row] = await db
    .select({
      businessConnectionId: users.businessConnectionId,
      businessConnectionEnabled: users.businessConnectionEnabled,
      businessVoiceReplyEnabled: users.businessVoiceReplyEnabled,
      businessLinkAnalysisEnabled: users.businessLinkAnalysisEnabled,
      businessVideoDownloadEnabled: users.businessVideoDownloadEnabled,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return {
    businessConnected: Boolean(row?.businessConnectionId && row.businessConnectionEnabled),
    voiceReplyEnabled: row?.businessVoiceReplyEnabled ?? true,
    linkAnalysisEnabled: row?.businessLinkAnalysisEnabled ?? true,
    videoDownloadEnabled: row?.businessVideoDownloadEnabled ?? true,
  };
}

export async function setVoiceReplyEnabled(enabled: boolean) {
  const userId = await requireUserId();
  await db
    .update(users)
    .set({ businessVoiceReplyEnabled: enabled })
    .where(eq(users.id, userId));
  revalidatePath("/shaxsiy-ai");
}

export async function setLinkAnalysisEnabled(enabled: boolean) {
  const userId = await requireUserId();
  await db
    .update(users)
    .set({ businessLinkAnalysisEnabled: enabled })
    .where(eq(users.id, userId));
  revalidatePath("/shaxsiy-ai");
}

export async function setVideoDownloadEnabled(enabled: boolean) {
  const userId = await requireUserId();
  await db
    .update(users)
    .set({ businessVideoDownloadEnabled: enabled })
    .where(eq(users.id, userId));
  revalidatePath("/shaxsiy-ai");
}
