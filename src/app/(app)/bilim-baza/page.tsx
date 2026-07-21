import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUserId } from "@/lib/actions/require-user";
import { listKnowledgeEntries } from "@/lib/actions/knowledge";
import { BilimBazaClient } from "./bilim-baza-client";

export default async function BilimBazaPage() {
  const userId = await requireUserId();
  const [entries, [user]] = await Promise.all([
    listKnowledgeEntries(),
    db
      .select({ assistantSystemPrompt: users.assistantSystemPrompt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ]);

  return (
    <BilimBazaClient
      initialEntries={entries}
      initialSystemPrompt={user?.assistantSystemPrompt ?? ""}
    />
  );
}
