import { getSession } from "@/lib/session";

export async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error("Sessiya topilmadi. Iltimos, qaytadan kiring.");
  }
  return session.userId;
}
