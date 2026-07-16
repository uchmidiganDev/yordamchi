import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { cards, expenses } from "@/db/schema";
import type { PaynetReceipt } from "./paynet-receipt";

export type ReceiptSaveResult =
  | { status: "created"; amount: number; cardName: string }
  | { status: "duplicate" };

// Parse qilingan chekni foydalanuvchining xarajatiga aylantiradi. Bot kontekstida
// (sessiyasiz) ishlagani uchun userId to'g'ridan-to'g'ri beriladi.
export async function saveReceiptExpense(
  userId: string,
  receipt: PaynetReceipt
): Promise<ReceiptSaveResult> {
  // Dedup: bir chek ikki marta yuborilsa takror yozilmasin.
  const existing = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(and(eq(expenses.userId, userId), eq(expenses.externalRef, receipt.txnNumber)))
    .limit(1);
  if (existing.length > 0) {
    return { status: "duplicate" };
  }

  const last4 = receipt.senderCardLast4;

  // Kartani oxirgi 4 raqam bo'yicha topamiz; topilmasa avtomatik yaratamiz.
  const userCards = await db.select().from(cards).where(eq(cards.userId, userId));

  let card = last4
    ? userCards.find((c) => c.numberMasked.replace(/\D/g, "").endsWith(last4))
    : undefined;

  if (!card) {
    const name = last4 ? `Karta ****${last4}` : "Paynet";
    const numberMasked = last4 ? `**** **** **** ${last4}` : "****";
    const [created] = await db
      .insert(cards)
      .values({ userId, name, numberMasked, brand: "uzcard" })
      .returning();
    card = created;
  }

  const title = receipt.recipientName
    ? `O'tkazma: ${receipt.recipientName}`
    : "Paynet o'tkazma";

  await db.insert(expenses).values({
    userId,
    cardId: card.id,
    title,
    category: "O'tkazma",
    amount: receipt.amount,
    externalRef: receipt.txnNumber,
    spentAt: receipt.spentAt,
  });

  return { status: "created", amount: receipt.amount, cardName: card.name };
}
