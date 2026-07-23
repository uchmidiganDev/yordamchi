// "/pdf" oqimi uchun kutilayotgan sessiya boshqaruvi: PDF fayl kelganda AI
// "Nima qilay?" deb so'raydi, shu chatdagi KEYINGI xabar (matn yoki ovoz)
// ko'rsatma sifatida qabul qilinadi. Har bir chat uchun faqat bitta
// kutilayotgan sessiya bo'ladi (yangi PDF kelsa, eskisi almashtiriladi).

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pdfSessions } from "@/db/schema";

export async function savePdfSession(
  userId: string,
  chatId: number,
  fileId: string,
  fileName: string | null
) {
  await db
    .insert(pdfSessions)
    .values({ userId, chatId: BigInt(chatId), fileId, fileName })
    .onConflictDoUpdate({
      target: pdfSessions.chatId,
      set: { fileId, fileName, createdAt: new Date() },
    });
}

export async function getPdfSession(chatId: number) {
  const [session] = await db
    .select()
    .from(pdfSessions)
    .where(eq(pdfSessions.chatId, BigInt(chatId)))
    .limit(1);
  return session ?? null;
}

export async function deletePdfSession(chatId: number) {
  await db.delete(pdfSessions).where(eq(pdfSessions.chatId, BigInt(chatId)));
}
