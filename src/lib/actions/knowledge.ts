"use server";

// AI Assistant bilim bazasi (knowledge base) uchun CRUD server action'lari.
// Admin sahifasi (/bilim-baza) shu yerdan foydalanadi; yozuvlar Telegram
// botdagi AI Assistant javoblarida kontekst sifatida ishlatiladi.

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { knowledgeEntries } from "@/db/schema";
import { requireUserId } from "./require-user";

export type KnowledgeEntryView = {
  id: string;
  title: string;
  content: string;
  createdAtISO: string;
  updatedAtISO: string;
};

function toView(row: typeof knowledgeEntries.$inferSelect): KnowledgeEntryView {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAtISO: row.createdAt.toISOString(),
    updatedAtISO: row.updatedAt.toISOString(),
  };
}

export async function listKnowledgeEntries(): Promise<KnowledgeEntryView[]> {
  const userId = await requireUserId();
  const rows = await db
    .select()
    .from(knowledgeEntries)
    .where(eq(knowledgeEntries.userId, userId))
    .orderBy(desc(knowledgeEntries.updatedAt));

  return rows.map(toView);
}

export async function createKnowledgeEntry(input: {
  title: string;
  content: string;
}) {
  const userId = await requireUserId();
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || !content) {
    throw new Error("Sarlavha va matn to'ldirilishi shart");
  }

  await db.insert(knowledgeEntries).values({ userId, title, content });

  revalidatePath("/bilim-baza");
}

export async function updateKnowledgeEntry(
  id: string,
  input: { title: string; content: string }
) {
  const userId = await requireUserId();
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || !content) {
    throw new Error("Sarlavha va matn to'ldirilishi shart");
  }

  await db
    .update(knowledgeEntries)
    .set({ title, content, updatedAt: new Date() })
    .where(
      and(eq(knowledgeEntries.id, id), eq(knowledgeEntries.userId, userId))
    );

  revalidatePath("/bilim-baza");
}

export async function deleteKnowledgeEntry(id: string) {
  const userId = await requireUserId();

  await db
    .delete(knowledgeEntries)
    .where(
      and(eq(knowledgeEntries.id, id), eq(knowledgeEntries.userId, userId))
    );

  revalidatePath("/bilim-baza");
}
