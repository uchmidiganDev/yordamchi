// Bot chatining doimiy menyu tugmasini (pastki chap burchak) web ilovani
// Telegram Mini App sifatida ochadigan qilib sozlaydi. Bir martalik sozlash
// — o'zgarmaguncha qayta ishga tushirish shart emas.
// Ishga tushirish: npx tsx scripts/set-mini-app-menu-button.ts

import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN topilmadi (.env.local)");
  if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL topilmadi (.env.local)");

  const { setChatMenuButton } = await import("../src/lib/telegram-api");
  await setChatMenuButton(token, appUrl, "Ochish");

  console.log(`Menyu tugmasi o'rnatildi: ${appUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
