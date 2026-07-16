"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { requireUserId } from "./require-user";

export type ExpenseInput = {
  cardId: string;
  title: string;
  category: string;
  amount: number;
  spentAt?: string;
};

export async function listExpenses() {
  const userId = await requireUserId();
  return db
    .select()
    .from(expenses)
    .where(eq(expenses.userId, userId))
    .orderBy(desc(expenses.spentAt));
}

export async function createExpense(input: ExpenseInput) {
  const userId = await requireUserId();
  const title = input.title.trim();
  const category = input.category.trim();
  if (!title || !category || !input.cardId || !input.amount || input.amount <= 0) {
    throw new Error("Barcha maydonlar to'g'ri to'ldirilishi shart");
  }

  await db.insert(expenses).values({
    userId,
    cardId: input.cardId,
    title,
    category,
    amount: Math.round(input.amount),
    spentAt: input.spentAt ? new Date(input.spentAt) : new Date(),
  });

  revalidatePath("/xarajat");
}

export async function deleteExpense(id: string) {
  const userId = await requireUserId();
  await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
  revalidatePath("/xarajat");
}
