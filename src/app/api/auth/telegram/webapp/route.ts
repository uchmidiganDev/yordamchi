import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { setSessionCookie } from "@/lib/session";
import { verifyTelegramWebAppInitData } from "@/lib/telegram-webapp-auth";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_TELEGRAM_ID = process.env.ALLOWED_TELEGRAM_ID;

// Telegram Mini App ichida ochilganda avtomatik kirish: brauzerdagi
// /start deeplink oqimi o'rniga, Telegram o'zi yuborgan `initData` bot
// tokeni bilan tekshirilib (2026-07-23), mos kelsa sessiya darhol ochiladi.
export async function POST(req: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN || !ALLOWED_TELEGRAM_ID) {
    return NextResponse.json(
      { ok: false, error: "server_misconfigured" },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => null);
  const initData = body?.initData;
  if (typeof initData !== "string" || !initData) {
    return NextResponse.json(
      { ok: false, error: "missing_init_data" },
      { status: 400 }
    );
  }

  const tgUser = verifyTelegramWebAppInitData(initData, TELEGRAM_BOT_TOKEN);
  if (!tgUser) {
    return NextResponse.json(
      { ok: false, error: "invalid_init_data" },
      { status: 401 }
    );
  }

  if (tgUser.id.toString() !== ALLOWED_TELEGRAM_ID) {
    return NextResponse.json({ ok: false, error: "not_owner" }, { status: 403 });
  }

  const telegramIdBig = BigInt(tgUser.id);

  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.telegramId, telegramIdBig))
    .limit(1);

  const user =
    existingUser ??
    (
      await db
        .insert(users)
        .values({
          telegramId: telegramIdBig,
          telegramUsername: tgUser.username,
          name: tgUser.first_name,
        })
        .returning()
    )[0];

  await setSessionCookie({
    userId: user.id,
    telegramId: user.telegramId.toString(),
  });

  return NextResponse.json({ ok: true });
}
