"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { goals, tasks } from "@/db/schema";
import { requireUserId } from "./require-user";

export type TaskInput = {
  title: string;
  goalId?: string | null;
  dueAt?: string; // ISO datetime-local qiymati, bo'sh bo'lishi mumkin
  priority: "high" | "mid" | "low";
};

export async function listTasksWithGoal() {
  const userId = await requireUserId();
  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      dueAt: tasks.dueAt,
      priority: tasks.priority,
      status: tasks.status,
      goalId: tasks.goalId,
      goalTitle: goals.title,
      createdAt: tasks.createdAt,
    })
    .from(tasks)
    .leftJoin(goals, eq(tasks.goalId, goals.id))
    .where(eq(tasks.userId, userId))
    .orderBy(asc(tasks.dueAt));
}

export async function createTask(input: TaskInput) {
  const userId = await requireUserId();
  const title = input.title.trim();
  if (!title) throw new Error("Sarlavha kiritilishi shart");

  await db.insert(tasks).values({
    userId,
    title,
    goalId: input.goalId || null,
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
    priority: input.priority,
  });

  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function updateTask(id: string, input: Partial<TaskInput>) {
  const userId = await requireUserId();

  await db
    .update(tasks)
    .set({
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.goalId !== undefined ? { goalId: input.goalId || null } : {}),
      ...(input.dueAt !== undefined
        ? { dueAt: input.dueAt ? new Date(input.dueAt) : null }
        : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
    })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

  revalidatePath("/tasks");
}

export async function toggleTaskStatus(id: string, done: boolean) {
  const userId = await requireUserId();
  await db
    .update(tasks)
    .set({ status: done ? "done" : "pending" })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

  revalidatePath("/tasks");
}

export async function deleteTask(id: string) {
  const userId = await requireUserId();
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  revalidatePath("/tasks");
}
