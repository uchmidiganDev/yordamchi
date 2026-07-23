// Telegram Mini App `initData`ni tekshirish — rasmiy algoritm:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AUTH_AGE_SECONDS = 24 * 60 * 60;

export type TelegramWebAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export function verifyTelegramWebAppInitData(
  initData: string,
  botToken: string
): TelegramWebAppUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1000 - authDate > MAX_AUTH_AGE_SECONDS) {
    return null;
  }

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const computedBuf = Buffer.from(computedHash, "hex");
  const receivedBuf = Buffer.from(hash, "hex");
  if (
    computedBuf.length !== receivedBuf.length ||
    !timingSafeEqual(computedBuf, receivedBuf)
  ) {
    return null;
  }

  const userRaw = params.get("user");
  if (!userRaw) return null;
  try {
    return JSON.parse(userRaw) as TelegramWebAppUser;
  } catch {
    return null;
  }
}
