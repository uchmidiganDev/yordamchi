"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { cards } from "@/db/schema";
import { requireUserId } from "./require-user";

export type CardInput = {
  name: string;
  numberMasked: string;
  brand: "uzcard" | "humo";
};

export async function listCards() {
  const userId = await requireUserId();
  return db
    .select()
    .from(cards)
    .where(eq(cards.userId, userId))
    .orderBy(desc(cards.createdAt));
}

export async function createCard(input: CardInput) {
  const userId = await requireUserId();
  const name = input.name.trim();
  const numberMasked = input.numberMasked.trim();
  if (!name || !numberMasked) {
    throw new Error("Nomi va raqami kiritilishi shart");
  }

  await db.insert(cards).values({
    userId,
    name,
    numberMasked,
    brand: input.brand,
  });

  revalidatePath("/xarajat");
}

export async function deleteCard(id: string) {
  const userId = await requireUserId();
  // expenses.card_id "on delete cascade" bo'lgani uchun tegishli xarajatlar avtomatik o'chadi.
  await db.delete(cards).where(and(eq(cards.id, id), eq(cards.userId, userId)));
  revalidatePath("/xarajat");
}
