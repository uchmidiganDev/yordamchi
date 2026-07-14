import { eq } from "drizzle-orm";
import { db } from "@/db";
import { loginTokens } from "@/db/schema";
import { setSessionCookie } from "@/lib/session";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return Response.json({ status: "invalid" }, { status: 400 });
  }

  const [loginToken] = await db
    .select()
    .from(loginTokens)
    .where(eq(loginTokens.token, token))
    .limit(1);

  if (!loginToken) {
    return Response.json({ status: "not_found" }, { status: 404 });
  }

  if (loginToken.status === "pending" && loginToken.expiresAt.getTime() < Date.now()) {
    return Response.json({ status: "expired" });
  }

  if (loginToken.status === "confirmed") {
    if (!loginToken.userId || loginToken.telegramId === null) {
      return Response.json({ status: "expired" });
    }

    await setSessionCookie({
      userId: loginToken.userId,
      telegramId: loginToken.telegramId.toString(),
    });

    // Token qayta ishlatilmasligi uchun darhol o'chiriladi.
    await db.delete(loginTokens).where(eq(loginTokens.token, token));

    return Response.json({ status: "confirmed" });
  }

  return Response.json({ status: loginToken.status });
}
