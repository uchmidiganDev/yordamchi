import { createHash } from "node:crypto";

// Paynet formatiga tushmaydigan istalgan PDF/matndan xarajat ma'lumotini
// ajratib beradi. Asosiy maqsad — matndan summani (va iloji bo'lsa sana,
// sarlavhani) topish, so'ng xarajat sifatida saqlash.

const MONTHS_UZ = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentabr",
  "oktabr",
  "noyabr",
  "dekabr",
];

export type GenericReceipt = {
  amount: number;
  spentAt: Date;
  title: string;
  ref: string; // dedup uchun matn hash'i
};

// Raqam guruhini butun songa aylantiradi. Oxiridagi kasr qismini (masalan
// ",00" yoki ".50") tashlab yuboradi, qolgan barcha ajratgichlarni olib
// tashlaydi. "1 250 000,00" -> 1250000
function toInt(raw: string): number {
  const noDecimals = raw.trim().replace(/[.,]\d{1,2}$/, "");
  const digits = noDecimals.replace(/\D/g, "");
  return digits ? parseInt(digits, 10) : NaN;
}

// Matndan eng ehtimoliy summani topadi. Avval valyuta so'zi (so'm/sum/uzs)
// bilan yozilgan summalarni oladi; topilmasa, mingliklar ajratgichi bilan
// yozilgan raqamlarni (masalan "150 000") oladi. Eng katta qiymat — jami
// summa deb olinadi.
function findAmount(text: string): number | null {
  const amounts: number[] = [];

  const currencyRe =
    /(\d[\d\s.,\u00a0\u202f]*\d|\d)\s*(?:so['‘`ʼ]?m|som|sum|uzs)/gi;
  for (const m of text.matchAll(currencyRe)) {
    const v = toInt(m[1]);
    if (Number.isFinite(v) && v > 0) amounts.push(v);
  }

  if (amounts.length === 0) {
    // Valyuta belgilanmagan — mingliklar ajratgichli raqamlarni izlaymiz.
    // (Karta raqamlari 4 xonali guruhlardan iborat bo'lgani uchun bu shablonga
    // tushmaydi.)
    const groupedRe = /\d{1,3}(?:[\s\u00a0\u202f.]\d{3})+/g;
    for (const m of text.matchAll(groupedRe)) {
      const v = toInt(m[0]);
      if (Number.isFinite(v) && v > 0) amounts.push(v);
    }
  }

  if (amounts.length === 0) return null;
  return Math.max(...amounts);
}

// Matndan sanani topadi: o'zbekcha oy nomi, dd.mm.yyyy yoki yyyy-mm-dd.
function findDate(text: string): Date {
  const uz = text.match(
    /(\d{1,2})-([a-z']+),?\s+(\d{4})(?:[\s,]+(\d{1,2}):(\d{2}))?/i
  );
  if (uz) {
    const monthIndex = MONTHS_UZ.indexOf(uz[2].toLowerCase());
    if (monthIndex >= 0) {
      return new Date(
        parseInt(uz[3], 10),
        monthIndex,
        parseInt(uz[1], 10),
        uz[4] ? parseInt(uz[4], 10) : 0,
        uz[5] ? parseInt(uz[5], 10) : 0
      );
    }
  }

  const dmy = text.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (dmy) {
    return new Date(
      parseInt(dmy[3], 10),
      parseInt(dmy[2], 10) - 1,
      parseInt(dmy[1], 10)
    );
  }

  const ymd = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    return new Date(
      parseInt(ymd[1], 10),
      parseInt(ymd[2], 10) - 1,
      parseInt(ymd[3], 10)
    );
  }

  return new Date();
}

export function parseGenericReceipt(
  text: string,
  fallbackTitle: string
): GenericReceipt | null {
  if (!text || !text.trim()) return null;

  const amount = findAmount(text);
  if (amount === null) return null; // summa topilmadi

  const spentAt = findDate(text);

  // Sarlavha: fayl nomi (kengaytmasiz), bo'lmasa matnning birinchi mazmunli
  // qatori.
  let title = fallbackTitle.replace(/\.[a-z0-9]+$/i, "").trim();
  if (!title) {
    const firstLine = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 2);
    title = firstLine ? firstLine.slice(0, 80) : "PDF chek";
  }

  const normalized = text.replace(/\s+/g, " ").trim();
  const ref =
    "pdf:" + createHash("sha256").update(normalized).digest("hex").slice(0, 32);

  return { amount, spentAt, title, ref };
}
