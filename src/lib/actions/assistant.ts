"use server";

// AI Assistant sozlamalari va suhbat — moslashtiriladigan system prompt
// (Telegram bot va veb-suhbat ikkalasi ham shundan foydalanadi) va AI
// sahifasidagi chat oynasi uchun server action.

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { answerAssistantQuestion } from "@/lib/assistant";
import { requireUserId } from "./require-user";

export async function updateAssistantSystemPrompt(prompt: string) {
  const userId = await requireUserId();
  const trimmed = prompt.trim();

  await db
    .update(users)
    .set({ assistantSystemPrompt: trimmed || null })
    .where(eq(users.id, userId));

  revalidatePath("/bilim-baza");
}

type AskResult = { ok: true; answer: string } | { ok: false; error: string };

// AI sahifasidagi suhbat oynasi shu action orqali javob oladi — Telegram
// botdagi bilan bir xil answerAssistantQuestion() ishlatiladi, shuning uchun
// javoblar Bilim bazasi va System Prompt'ga bir xilda tayanadi.
export async function askAssistant(question: string): Promise<AskResult> {
  const userId = await requireUserId();
  const trimmed = question.trim();
  if (!trimmed) return { ok: false, error: "Savol kiritilmadi" };

  try {
    const answer = await answerAssistantQuestion(userId, trimmed);
    return { ok: true, answer };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Noma'lum xatolik yuz berdi",
    };
  }
}
