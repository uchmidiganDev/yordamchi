"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { goals } from "@/db/schema";
import { requireUserId } from "./require-user";

export type GoalInput = {
  title: string;
  description?: string;
  dueDate?: string; // "yyyy-mm-dd" yoki bo'sh
};

export async function listGoals() {
  const userId = await requireUserId();
  return db
    .select()
    .from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(desc(goals.createdAt));
}

export async function createGoal(input: GoalInput) {
  const userId = await requireUserId();
  const title = input.title.trim();
  if (!title) throw new Error("Sarlavha kiritilishi shart");

  await db.insert(goals).values({
    userId,
    title,
    description: input.description?.trim() || null,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
  });

  revalidatePath("/");
}

export async function updateGoal(
  id: string,
  input: Partial<GoalInput> & { progress?: number; status?: "active" | "done" }
) {
  const userId = await requireUserId();

  await db
    .update(goals)
    .set({
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description.trim() || null }
        : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
        : {}),
      ...(input.progress !== undefined
        ? { progress: Math.max(0, Math.min(100, input.progress)) }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    })
    .where(and(eq(goals.id, id), eq(goals.userId, userId)));

  revalidatePath("/");
}

export async function deleteGoal(id: string) {
  const userId = await requireUserId();
  await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
  revalidatePath("/");
  revalidatePath("/tasks");
}
