"use server";

// AI Coding Assistant bilim bazasi (loyiha konvensiyalari, coding
// standartlari) uchun CRUD server action'lari. Admin sahifasi
// (/kod-yordamchi) shu yerdan foydalanadi; yozuvlar Telegram botdagi kod
// tahlili/fix/optimize javoblarida kontekst sifatida ishlatiladi.

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { codeKnowledgeEntries } from "@/db/schema";
import { requireUserId } from "./require-user";

export type CodeKnowledgeEntryView = {
  id: string;
  title: string;
  content: string;
  createdAtISO: string;
  updatedAtISO: string;
};

function toView(
  row: typeof codeKnowledgeEntries.$inferSelect
): CodeKnowledgeEntryView {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAtISO: row.createdAt.toISOString(),
    updatedAtISO: row.updatedAt.toISOString(),
  };
}

export async function listCodeKnowledgeEntries(): Promise<CodeKnowledgeEntryView[]> {
  const userId = await requireUserId();
  const rows = await db
    .select()
    .from(codeKnowledgeEntries)
    .where(eq(codeKnowledgeEntries.userId, userId))
    .orderBy(desc(codeKnowledgeEntries.updatedAt));

  return rows.map(toView);
}

export async function createCodeKnowledgeEntry(input: {
  title: string;
  content: string;
}) {
  const userId = await requireUserId();
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || !content) {
    throw new Error("Sarlavha va matn to'ldirilishi shart");
  }

  await db.insert(codeKnowledgeEntries).values({ userId, title, content });

  revalidatePath("/kod-yordamchi");
}

export async function updateCodeKnowledgeEntry(
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
    .update(codeKnowledgeEntries)
    .set({ title, content, updatedAt: new Date() })
    .where(
      and(eq(codeKnowledgeEntries.id, id), eq(codeKnowledgeEntries.userId, userId))
    );

  revalidatePath("/kod-yordamchi");
}

export async function deleteCodeKnowledgeEntry(id: string) {
  const userId = await requireUserId();

  await db
    .delete(codeKnowledgeEntries)
    .where(
      and(eq(codeKnowledgeEntries.id, id), eq(codeKnowledgeEntries.userId, userId))
    );

  revalidatePath("/kod-yordamchi");
}
