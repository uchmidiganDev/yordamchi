// Foydalanuvchi vaqt mintaqasi bo'yicha kun chegaralarini hisoblash.
// Server (Vercel) UTC'da ishlagani uchun "bugun" tushunchasi foydalanuvchi
// mintaqasida hisoblanishi kerak. Bu hisob-kitoblar faqat serverda ishlatiladi
// (Node to'liq ICU) — sana KO'RSATISH uchun esa format-date.ts qoidasi amal
// qiladi.

// Berilgan vaqtning foydalanuvchi mintaqasidagi sanasi (YYYY-MM-DD).
export function dateStrInTz(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

// Berilgan vaqtning foydalanuvchi mintaqasidagi soati (HH:MM).
export function timeStrInTz(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}

// Mintaqaning UTC'dan siljishi (millisekundlarda) berilgan paytda.
function tzOffsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second")
  );
  return asUtc - at.getTime();
}

// YYYY-MM-DD sananing foydalanuvchi mintaqasidagi kun boshlanishi va oxiri
// (UTC instant sifatida). Masalan Asia/Tashkent uchun 2026-07-20 kuni
// 19:00 UTC (19-iyul) dan 19:00 UTC (20-iyul) gacha.
export function dayRangeInTz(
  dateStr: string,
  timeZone: string
): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split("-").map(Number);
  // Dastlab UTC deb faraz qilib, keyin mintaqa siljishi bilan tuzatamiz.
  const guess = new Date(Date.UTC(y, m - 1, d));
  const start = new Date(guess.getTime() - tzOffsetMs(timeZone, guess));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// Sanaga kun qo'shish (YYYY-MM-DD → YYYY-MM-DD, UTC arifmetika bilan).
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// YYYY-MM-DD uchun hafta kuni indeksi (0=Dushanba ... 6=Yakshanba).
export function weekdayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Yak
  return day === 0 ? 6 : day - 1;
}
