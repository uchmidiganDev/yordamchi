import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireUserId } from "@/lib/actions/require-user";
import { SozlamalarClient } from "./sozlamalar-client";

export default async function SozlamalarPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string }>;
}) {
  const userId = await requireUserId();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const { google } = await searchParams;

  return (
    <SozlamalarClient
      initial={{
        name: user.name ?? "",
        telegramUsername: user.telegramUsername,
        telegramId: user.telegramId.toString(),
        timezone: user.timezone,
        morningTime: user.morningTime.slice(0, 5),
        eveningTime: user.eveningTime.slice(0, 5),
        googleConnected: Boolean(user.googleRefreshToken),
      }}
      googleStatus={google === "connected" ? "connected" : google === "error" ? "error" : null}
    />
  );
}
