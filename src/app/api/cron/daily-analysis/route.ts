// Vercel Cron orqali chaqiriladi (vercel.json'dagi "crons") — har bir
// foydalanuvchi uchun uning O'Z vaqt mintaqasidagi joriy vaqt
// morning_time/evening_time'ga yetarlicha yaqin bo'lsa (WINDOW_MINUTES
// ichida) va shu kunga hali yuborilmagan bo'lsa, AI tahlil (analysis-engine)
// ishga tushirilib, natija Telegram'ga (foydalanuvchining shaxsiy chatiga)
// yuboriladi.
//
// MUHIM (Hobby tarif cheklovi): Vercel Hobby'da Cron Job kuniga faqat 1
// marta ishga tushadi — shu sabab vercel.json'da ANIQ IKKITA cron yozuvi bor
// (foydalanuvchining hozirgi morning_time/evening_time'iga mos UTC vaqtda).
// Agar Sozlamalar'da vaqt sezilarli o'zgartirilsa, vercel.json'dagi cron
// vaqtlarini ham yangilab qayta deploy qilish kerak bo'ladi (WINDOW_MINUTES
// atrofidagi kichik o'zgarishlar qayta deploysiz ham ishlayveradi).

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { runAnalysisForUser } from "@/lib/analysis-engine";
import { formatDailyMessage } from "@/lib/daily-message";
import { sendMessage } from "@/lib/telegram-api";
import { dateStrInTz, timeStrInTz } from "@/lib/tz";

export const maxDuration = 60;

const WINDOW_MINUTES = 30;

function minutesSinceMidnight(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function withinWindow(nowHHMM: string, targetTime: string): boolean {
  const diff = Math.abs(
    minutesSinceMidnight(nowHHMM) - minutesSinceMidnight(targetTime.slice(0, 5))
  );
  return diff <= WINDOW_MINUTES;
}

type RunResult = { userId: string; kind: "morning" | "evening"; ok: boolean; error?: string };

async function runKind(
  user: typeof users.$inferSelect,
  kind: "morning" | "evening",
  token: string,
  todayStr: string
): Promise<void> {
  const analysis = await runAnalysisForUser(user.id, kind);
  if (!analysis.content) {
    throw new Error("AI tahlil natijasini o'qib bo'lmadi");
  }
  const text = formatDailyMessage(kind, analysis.content, todayStr);
  await sendMessage(token, user.telegramId, text);

  await db
    .update(users)
    .set(kind === "morning" ? { lastMorningSentDate: todayStr } : { lastEveningSentDate: todayStr })
    .where(eq(users.id, user.id));
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return Response.json({ ok: false, error: "TELEGRAM_BOT_TOKEN topilmadi" }, { status: 500 });
  }

  const allUsers = await db.select().from(users);
  const results: RunResult[] = [];
  const now = new Date();

  for (const user of allUsers) {
    const nowHHMM = timeStrInTz(now, user.timezone);
    const todayStr = dateStrInTz(now, user.timezone);

    if (withinWindow(nowHHMM, user.morningTime) && user.lastMorningSentDate !== todayStr) {
      try {
        await runKind(user, "morning", token, todayStr);
        results.push({ userId: user.id, kind: "morning", ok: true });
      } catch (error) {
        console.error("[cron/daily-analysis] ertalabki xato", user.id, error);
        results.push({
          userId: user.id,
          kind: "morning",
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (withinWindow(nowHHMM, user.eveningTime) && user.lastEveningSentDate !== todayStr) {
      try {
        await runKind(user, "evening", token, todayStr);
        results.push({ userId: user.id, kind: "evening", ok: true });
      } catch (error) {
        console.error("[cron/daily-analysis] kechqurungi xato", user.id, error);
        results.push({
          userId: user.id,
          kind: "evening",
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return Response.json({ ok: true, checked: allUsers.length, results });
}
