// Paynet "Komissiyasiz o'tkazmalar" chekining matnini o'qib, xarajat sifatida
// saqlash uchun kerakli maydonlarni ajratib beradi. Chek Telegram botga matn
// ko'rinishida forward qilinganda ishlatiladi.

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

export type PaynetReceipt = {
  txnNumber: string;
  amount: number; // kartadan yechilgan jami summa (so'm)
  spentAt: Date;
  senderCardLast4: string | null;
  recipientCardLast4: string | null;
  recipientName: string | null;
};

// Raqamlar orasidagi bo'shliqlarni (oddiy, nbsp, narrow-nbsp) olib tashlab,
// butun songa aylantiradi. "8 056" -> 8056
function toAmount(raw: string): number {
  const digits = raw.replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : NaN;
}

function lastFour(line: string | null): string | null {
  if (!line) return null;
  const m = line.match(/(\d{4})(?!.*\d)/);
  return m ? m[1] : null;
}

export function parsePaynetReceipt(text: string): PaynetReceipt | null {
  if (!text) return null;

  // Paynet o'tkazma cheki ekanini tekshiramiz.
  const isReceipt =
    /tranzaksiya raqami/i.test(text) &&
    (/operatsiya bajarildi/i.test(text) || /o\S?tkaz/i.test(text));
  if (!isReceipt) return null;

  // Tranzaksiya raqami (dedup uchun asosiy kalit).
  const txnMatch = text.match(/tranzaksiya raqami\D*(\d{5,})/i);
  if (!txnMatch) return null;
  const txnNumber = txnMatch[1];

  // Jami summa: "Operatsiya bajarildi" dan keyingi birinchi "N so'm".
  let amountMatch = text.match(
    /operatsiya bajarildi[\s\S]*?([\d][\d\s\u00a0\u202f]*)\s*so\S?m/i
  );
  if (!amountMatch) {
    amountMatch = text.match(/([\d][\d\s\u00a0\u202f]*)\s*so\S?m/i);
  }
  if (!amountMatch) return null;
  const amount = toAmount(amountMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  // Sana/vaqt: "7-iyul, 2026 14:25".
  let spentAt = new Date();
  const dateMatch = text.match(
    /(\d{1,2})-([a-z]+),?\s+(\d{4})[\s,]+(\d{1,2}):(\d{2})/i
  );
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const monthIndex = MONTHS_UZ.indexOf(dateMatch[2].toLowerCase());
    const year = parseInt(dateMatch[3], 10);
    const hour = parseInt(dateMatch[4], 10);
    const minute = parseInt(dateMatch[5], 10);
    if (monthIndex >= 0) {
      spentAt = new Date(year, monthIndex, day, hour, minute);
    }
  }

  // Qatorlar bo'yicha "yorliq -> keyingi qator" mantiqi.
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const valueAfter = (pred: (line: string) => boolean): string | null => {
    const i = lines.findIndex(pred);
    if (i >= 0 && i + 1 < lines.length) return lines[i + 1];
    return null;
  };

  const senderCardLast4 = lastFour(valueAfter((l) => /karta orqali to/i.test(l)));
  const recipientCardLast4 = lastFour(
    valueAfter((l) => /kartaga o\S?tkazildi/i.test(l))
  );
  const recipientName = valueAfter((l) => /qabul qiluvchining/i.test(l));

  return {
    txnNumber,
    amount,
    spentAt,
    senderCardLast4,
    recipientCardLast4,
    recipientName: recipientName || null,
  };
}
