"use server";

// AI Coding Assistant uchun qo'shimcha ko'rsatma (system prompt) sozlamasi
// — /kod-yordamchi sahifasidagi kartochka shu yerdan foydalanadi.

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUserId } from "./require-user";

export async function updateCodeAssistantSystemPrompt(prompt: string) {
  const userId = await requireUserId();
  const trimmed = prompt.trim();

  await db
    .update(users)
    .set({ codeAssistantSystemPrompt: trimmed || null })
    .where(eq(users.id, userId));

  revalidatePath("/kod-yordamchi");
}
