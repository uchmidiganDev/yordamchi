"use server";

// Telefon bo'limidagi AI shaxslar (personas) — CRUD, faol persona tanlash va
// telefon AI'sini yoqish/o'chirish (Start/Stop).

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { aiPersonas, users } from "@/db/schema";
import { requireUserId } from "./require-user";

const DEFAULT_YUSUF_PROMPT = [
  "Sen \"Yusuf AI\" — Tommy Sodiqjonovning telefon qo'ng'iroqlariga javob beruvchi shaxsiy AI yordamchisisan.",
  "Suhbatni boshlaganda o'zingni qisqacha tanishtir: \"Salom, men Yusuf AI, Tommy'ning yordamchisiman.\"",
  "Javoblaring OVOZ orqali o'qib eshittiriladi — shuning uchun qisqa, tabiiy va aniq gaplar bilan gapir; ro'yxat, jadval yoki murakkab formatlashdan saqlan.",
  "Avval Bilim bazasidagi ma'lumotlarga tayan. Aniq javob bera olmasang, Tommy bilan keyinroq bog'lanishni taklif qil.",
].join(" ");

export type PersonaView = {
  id: string;
  name: string;
  systemPrompt: string;
  createdAtISO: string;
};

// Personalar ro'yxatini qaytaradi; hali birorta ham yo'q bo'lsa "Yusuf AI"
// standart persona sifatida yaratilib, faol qilib belgilanadi.
export async function listPersonas(): Promise<PersonaView[]> {
  const userId = await requireUserId();
  const rows = await db
    .select()
    .from(aiPersonas)
    .where(eq(aiPersonas.userId, userId))
    .orderBy(desc(aiPersonas.createdAt));

  if (rows.length === 0) {
    const [created] = await db
      .insert(aiPersonas)
      .values({ userId, name: "Yusuf AI", systemPrompt: DEFAULT_YUSUF_PROMPT })
      .returning();
    await db
      .update(users)
      .set({ activePersonaId: created.id })
      .where(eq(users.id, userId));
    return [
      {
        id: created.id,
        name: created.name,
        systemPrompt: created.systemPrompt,
        createdAtISO: created.createdAt.toISOString(),
      },
    ];
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    systemPrompt: r.systemPrompt,
    createdAtISO: r.createdAt.toISOString(),
  }));
}

export async function getPhoneStatus() {
  const userId = await requireUserId();
  const [row] = await db
    .select({ enabled: users.phoneAiEnabled, activePersonaId: users.activePersonaId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return { enabled: row?.enabled ?? false, activePersonaId: row?.activePersonaId ?? null };
}

export async function createPersona(input: { name: string; systemPrompt: string }) {
  const userId = await requireUserId();
  const name = input.name.trim();
  const systemPrompt = input.systemPrompt.trim();
  if (!name || !systemPrompt) throw new Error("Ism va System Prompt to'ldirilishi shart");

  await db.insert(aiPersonas).values({ userId, name, systemPrompt });
  revalidatePath("/telefon");
}

export async function updatePersona(
  id: string,
  input: { name: string; systemPrompt: string }
) {
  const userId = await requireUserId();
  const name = input.name.trim();
  const systemPrompt = input.systemPrompt.trim();
  if (!name || !systemPrompt) throw new Error("Ism va System Prompt to'ldirilishi shart");

  await db
    .update(aiPersonas)
    .set({ name, systemPrompt, updatedAt: new Date() })
    .where(and(eq(aiPersonas.id, id), eq(aiPersonas.userId, userId)));
  revalidatePath("/telefon");
}

export async function deletePersona(id: string) {
  const userId = await requireUserId();

  await db
    .update(users)
    .set({ activePersonaId: null })
    .where(and(eq(users.id, userId), eq(users.activePersonaId, id)));

  await db
    .delete(aiPersonas)
    .where(and(eq(aiPersonas.id, id), eq(aiPersonas.userId, userId)));

  revalidatePath("/telefon");
}

export async function setActivePersona(id: string) {
  const userId = await requireUserId();

  const [persona] = await db
    .select({ id: aiPersonas.id })
    .from(aiPersonas)
    .where(and(eq(aiPersonas.id, id), eq(aiPersonas.userId, userId)))
    .limit(1);
  if (!persona) throw new Error("Persona topilmadi");

  await db.update(users).set({ activePersonaId: id }).where(eq(users.id, userId));
  revalidatePath("/telefon");
}

export async function setPhoneAiEnabled(enabled: boolean) {
  const userId = await requireUserId();
  await db.update(users).set({ phoneAiEnabled: enabled }).where(eq(users.id, userId));
  revalidatePath("/telefon");
}
