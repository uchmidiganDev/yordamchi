"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUserId } from "./require-user";

export type SettingsInput = {
  name: string;
  timezone: string;
  morningTime: string;
  eveningTime: string;
};

export async function updateSettings(input: SettingsInput) {
  const userId = await requireUserId();

  await db
    .update(users)
    .set({
      name: input.name.trim() || null,
      timezone: input.timezone,
      morningTime: input.morningTime,
      eveningTime: input.eveningTime,
    })
    .where(eq(users.id, userId));

  revalidatePath("/sozlamalar");
}

export async function disconnectGoogle() {
  const userId = await requireUserId();

  await db
    .update(users)
    .set({ googleRefreshToken: null })
    .where(eq(users.id, userId));

  revalidatePath("/sozlamalar");
}
