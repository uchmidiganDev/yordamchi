// Mehmon/mijoz AI Assistant orqali ilova egasiga mo'ljallangan aniq
// topshiriq/eslatma qoldirsa (answerGuestQuestion()'ning ownerTask maydoni),
// bu funksiya uni "Vazifalar" ro'yxatiga qo'shadi VA egasiga darhol Telegram
// orqali xabar yuboradi. Haqiqiy telefon qo'ng'irog'i EMAS — foydalanuvchi
// 2026-07-23'da buni PSTN (Telnyx, pullik, hozircha faollashtirilmagan)
// o'rniga bepul va darhol ishlaydigan muqobil sifatida tanladi.

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks, users } from "@/db/schema";
import { sendMessage } from "./telegram-api";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function notifyOwnerOfTask(
  ownerId: string,
  taskText: string,
  fromLabel: string
): Promise<void> {
  await db.insert(tasks).values({ userId: ownerId, title: taskText });

  if (!TELEGRAM_BOT_TOKEN) return;

  const [owner] = await db
    .select({ telegramId: users.telegramId })
    .from(users)
    .where(eq(users.id, ownerId))
    .limit(1);
  if (!owner) return;

  try {
    await sendMessage(
      TELEGRAM_BOT_TOKEN,
      owner.telegramId,
      `📋 Yangi topshiriq (${fromLabel}):\n\n${taskText}\n\nVazifalar ro'yxatiga ham qo'shildi.`
    );
  } catch (error) {
    console.error("[owner-task] Telegram xabar yuborishda xato", error);
  }
}
