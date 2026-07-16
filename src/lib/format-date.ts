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

// Intl.toLocaleDateString("uz-UZ", ...) natijasi server (Node, to'liq ICU) va
// brauzer (qisman ICU) o'rtasida farq qilib, gidratsiya xatosiga sabab bo'lgani
// uchun sana serverda ham, klientda ham bir xil natija beradigan qo'lda
// formatlanadi.
export function formatDateUz(date: Date) {
  return `${date.getDate()}-${MONTHS_UZ[date.getMonth()]}, ${date.getFullYear()}`;
}

export function formatDateShortUz(date: Date) {
  return `${date.getDate()}-${MONTHS_UZ[date.getMonth()]}`;
}

export function formatTimeUz(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
