import { webhookCallback } from "grammy";
import { bot } from "@/lib/telegram-bot";

// Standart 10s'dan uzunroq — video yuklab berish (YouTube/Instagram), sayt
// tahlili, rasm generatsiya (/img) va rasm->video (Veo) kabi amallar ba'zan
// undan ko'proq vaqt oladi. Veo oqimi ayniqsa uzun: submitVideoJob (503'da
// qayta urinish bilan ~40s'gacha) + waitForVideoJob (qattiq kutish) +
// video yuklab-yuborish yig'indisi 60s'dan oshib ketishi mumkin edi — bu
// production'da (Vercel funksiya majburan o'chirilgani sabab) "tayyorlanmoqda"
// xabaridan keyin javob kelmasligiga olib kelgan (localhost'da esa duration
// cheklovi yo'qligi sabab bu ko'rinmagan edi). `vercel.json`dagi
// `"fluid": true` Hobby tarifida 300s'gacha ruxsat beradi. Jonli sinovda
// (2026-07-29) realistik portretda generatsiya ~90-100s davom etgani
// aniqlanib, `telegram-bot.ts`dagi VEO_WAIT_DEADLINE_MS 100s'ga oshirilgach,
// shunga mos xavfsiz zaxira bilan 180s'ga ko'tarildi.
export const maxDuration = 180;

// MUHIM: `export const maxDuration` faqat Vercel funksiya vaqtini
// belgilaydi — grammy'ning o'zining `webhookCallback()`i ICHKI ravishda
// ALOHIDA, standart 10 soniyalik timeout qo'yadi (onTimeout: "throw"),
// bu Vercel'ning maxDuration'iga umuman aloqasi yo'q. Shu sabab jonli
// sinovda "Request timed out after 10000 ms" -> 500 xatosi maxDuration=60
// qo'yilganidan keyin ham davom etardi. `timeoutMilliseconds: Infinity`
// grammy'ning o'z ichki timeout o'ramini butunlay o'chirib, yagona haqiqiy
// chegara sifatida yuqoridagi maxDuration'ni qoldiradi.
const handleUpdate = webhookCallback(bot, "std/http", {
  timeoutMilliseconds: Infinity,
});

export async function POST(req: Request) {
  const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
  if (secretHeader !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  return handleUpdate(req);
}
