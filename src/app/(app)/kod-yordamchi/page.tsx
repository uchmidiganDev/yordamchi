import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUserId } from "@/lib/actions/require-user";
import { listCodeKnowledgeEntries } from "@/lib/actions/code-knowledge";
import { KodYordamchiClient } from "./kod-yordamchi-client";

export default async function KodYordamchiPage() {
  const userId = await requireUserId();
  const [entries, [user]] = await Promise.all([
    listCodeKnowledgeEntries(),
    db
      .select({ codeAssistantSystemPrompt: users.codeAssistantSystemPrompt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ]);

  return (
    <KodYordamchiClient
      initialEntries={entries}
      initialSystemPrompt={user?.codeAssistantSystemPrompt ?? ""}
    />
  );
}
