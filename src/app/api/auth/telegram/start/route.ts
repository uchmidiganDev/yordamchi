import { randomUUID } from "crypto";
import { db } from "@/db";
import { loginTokens } from "@/db/schema";

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 daqiqa

export async function POST() {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.insert(loginTokens).values({
    token,
    status: "pending",
    expiresAt,
  });

  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  const deepLink = `https://t.me/${botUsername}?start=${token}`;

  return Response.json({ token, deepLink });
}
