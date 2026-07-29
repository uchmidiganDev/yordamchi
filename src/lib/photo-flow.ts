// Rasm -> AI video generatsiya oqimi uchun kutilayotgan sessiya boshqaruvi:
// rasm caption'siz kelsa AI "Bu odam nima desin?" deb so'raydi, shu chatdagi
// KEYINGI xabar (matn yoki ovoz) ko'rsatma sifatida qabul qilinadi. Har bir
// chat uchun faqat bitta kutilayotgan sessiya bo'ladi (yangi rasm kelsa,
// eskisi almashtiriladi). `pdf-flow.ts`dagi bilan bir xil naqsh.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { photoSessions } from "@/db/schema";

export async function savePhotoSession(
  userId: string,
  chatId: number,
  fileId: string
) {
  await db
    .insert(photoSessions)
    .values({ userId, chatId: BigInt(chatId), fileId })
    .onConflictDoUpdate({
      target: photoSessions.chatId,
      set: { fileId, createdAt: new Date() },
    });
}

export async function getPhotoSession(chatId: number) {
  const [session] = await db
    .select()
    .from(photoSessions)
    .where(eq(photoSessions.chatId, BigInt(chatId)))
    .limit(1);
  return session ?? null;
}

export async function deletePhotoSession(chatId: number) {
  await db
    .delete(photoSessions)
    .where(eq(photoSessions.chatId, BigInt(chatId)));
}
