"use server";

// /telegram sahifasidagi bot boshqaruvi — qo'shish, yoqish/o'chirish,
// o'chirib tashlash va xabarlar jurnalini o'qish.

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { telegramBots, telegramMessages } from "@/db/schema";
import { deleteWebhook, getMe, setWebhook } from "@/lib/telegram-api";
import { requireUserId } from "./require-user";

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Noma'lum xatolik yuz berdi";
}

export async function listTelegramBots() {
  const userId = await requireUserId();
  return db
    .select({
      id: telegramBots.id,
      username: telegramBots.username,
      enabled: telegramBots.enabled,
      createdAt: telegramBots.createdAt,
    })
    .from(telegramBots)
    .where(eq(telegramBots.userId, userId))
    .orderBy(desc(telegramBots.createdAt));
}

export async function listTelegramMessages() {
  const userId = await requireUserId();
  const rows = await db
    .select({
      id: telegramMessages.id,
      botUsername: telegramBots.username,
      fromName: telegramMessages.fromName,
      fromUsername: telegramMessages.fromUsername,
      text: telegramMessages.text,
      answer: telegramMessages.answer,
      createdAt: telegramMessages.createdAt,
    })
    .from(telegramMessages)
    .innerJoin(telegramBots, eq(telegramMessages.botId, telegramBots.id))
    .where(eq(telegramMessages.userId, userId))
    .orderBy(desc(telegramMessages.createdAt))
    .limit(50);

  return rows.map((r) => ({ ...r, createdAtISO: r.createdAt.toISOString() }));
}

// Yangi bot qo'shadi: token Telegram'da tekshiriladi (getMe), DB'ga
// saqlanadi va webhook avtomatik ro'yxatdan o'tkaziladi. Standart holatda
// o'chirilgan (enabled: false) — foydalanuvchi o'zi yoqishi kerak.
export async function addTelegramBot(token: string): Promise<ActionResult<{ username: string }>> {
  const userId = await requireUserId();
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, error: "Token kiritilmadi" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const webhookSecret = process.env.TG_PUBLIC_BOT_WEBHOOK_SECRET;
  if (!appUrl || !webhookSecret) {
    return { ok: false, error: "Server sozlamalari to'liq emas (APP_URL yoki webhook secret)" };
  }

  try {
    const info = await getMe(trimmed);

    if (info.username === process.env.TELEGRAM_BOT_USERNAME) {
      return {
        ok: false,
        error: `@${info.username} — bu sizning shaxsiy botingiz, u allaqachon ulangan va bu yerga qo'shilmaydi.`,
      };
    }

    const existing = await db
      .select({ id: telegramBots.id })
      .from(telegramBots)
      .where(and(eq(telegramBots.userId, userId), eq(telegramBots.username, info.username)))
      .limit(1);
    if (existing.length > 0) {
      return { ok: false, error: `@${info.username} allaqachon qo'shilgan` };
    }

    const [row] = await db
      .insert(telegramBots)
      .values({ userId, token: trimmed, username: info.username, enabled: false })
      .returning({ id: telegramBots.id });

    const webhookUrl = `${appUrl}/api/telegram/bots/${row.id}/webhook`;
    await setWebhook(trimmed, webhookUrl, webhookSecret);

    revalidatePath("/telegram");
    return { ok: true, data: { username: info.username } };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function setTelegramBotEnabled(botId: string, enabled: boolean) {
  const userId = await requireUserId();
  await db
    .update(telegramBots)
    .set({ enabled })
    .where(and(eq(telegramBots.id, botId), eq(telegramBots.userId, userId)));

  revalidatePath("/telegram");
}

export async function removeTelegramBot(botId: string) {
  const userId = await requireUserId();

  const [row] = await db
    .select({ token: telegramBots.token })
    .from(telegramBots)
    .where(and(eq(telegramBots.id, botId), eq(telegramBots.userId, userId)))
    .limit(1);
  if (!row) return;

  try {
    await deleteWebhook(row.token);
  } catch (e) {
    console.error("[telegram-bots] webhookni o'chirishda xato", e);
  }

  await db
    .delete(telegramBots)
    .where(and(eq(telegramBots.id, botId), eq(telegramBots.userId, userId)));

  revalidatePath("/telegram");
}
