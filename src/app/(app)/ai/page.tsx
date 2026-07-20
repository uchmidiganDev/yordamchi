import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { listAnalyses } from "@/lib/actions/ai";
import { requireUserId } from "@/lib/actions/require-user";
import { isGeminiConfigured } from "@/lib/gemini";
import { AiClient } from "./ai-client";

export default async function AiPage() {
  const userId = await requireUserId();
  const [analysesList, [user]] = await Promise.all([
    listAnalyses(),
    db
      .select({ googleRefreshToken: users.googleRefreshToken })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ]);

  return (
    <AiClient
      initialAnalyses={analysesList}
      geminiConfigured={isGeminiConfigured()}
      googleConnected={Boolean(user?.googleRefreshToken)}
    />
  );
}
