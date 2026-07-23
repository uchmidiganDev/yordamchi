// PDF hujjat yaratish/tahrirlash yordamchisi ("/pdf" oqimi uchun). `pdf-lib`
// ishlatiladi — sof JS/TS, tashqi binary/font fayl talab qilmaydi, Vercel
// serverless muhitida ffmpeg/Puppeteer'siz ishlaydi (loyihaning boshqa
// qismlaridagi yengil bog'liqlik konvensiyasiga mos).
//
// MUHIM DIZAYN QARORI: dastlabki versiya butun PDF'ni Gemini natijasidan
// QAYTADAN, boshidan yaratardi — bu foydalanuvchi faqat kichik bir joyni
// o'zgartirishni so'raganda ham butun hujjat dizaynini (asl shrift/joylashuv
// o'rniga oddiy Helvetica matn) buzib qo'yardi. Foydalanuvchi buni aniq
// shikoyat qildi: "dizaynga tegmasin, aytgan joyni o'zgartirsin xolos".
// Tuzatish: `applyPdfEdit()` asl PDF'dagi O'ZGARTIRILMAGAN sahifalarni AYNAN
// asl holicha (bayt darajasida, pdf-lib copyPages orqali) saqlab qoladi —
// faqat ko'rsatmaga tegishli sahifa(lar) yangi oddiy matn bilan almashadi.
// CHEKLOV: almashtirilgan sahifa(lar)ning o'zi hamon oddiy Helvetica
// uslubida qayta chiziladi (asl shrift/rang/rasm SAQLANMAYDI) — sahifa
// ichidagi aniq joyni piksel darajasida tahrirlash (masalan bitta so'zni
// asl shrift bilan almashtirish) content-stream darajasidagi PDF tahririni
// talab qiladi, bu ancha katta murakkablik va hozircha qo'llanilmadi.
// Ammo endi hujjatning QOLGAN qismi (o'zgartirilmagan sahifalar) 100%
// asl dizaynda qoladi — bu asosiy shikoyatni hal qiladi.

import { PDFDocument, PDFFont, StandardFonts } from "pdf-lib";

const PAGE_WIDTH = 595.28; // A4, nuqta (pt)
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const FONT_SIZE = 11;
const LINE_HEIGHT = FONT_SIZE * 1.4;
const TITLE_SIZE = 15;

// WinAnsi (cp1252) 0x80-0x9F oralig'ida Latin-1'dan farqli, lekin keng
// tarqalgan "aqlli" tinish belgilarini o'z ichiga oladi — shularni aniq
// ruxsat etilgan deb belgilaymiz.
const WINANSI_EXTRA = new Set([
  0x2018, 0x2019, 0x201c, 0x201d, // qo'shtirnoqlar
  0x2013, 0x2014, // tire turlari
  0x2026, // uch nuqta
  0x2022, // bullet
  0x00a9, 0x00ae, // (c) (r)
]);

function sanitizeForPdf(text: string): string {
  return Array.from(text)
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0x3f;
      if (code <= 0x7e) return ch; // ASCII
      if (code >= 0xa0 && code <= 0xff) return ch; // Latin-1 supplement
      if (WINANSI_EXTRA.has(code)) return ch;
      return "?";
    })
    .join("");
}

function wrapLine(line: string, font: PDFFont, maxWidth: number): string[] {
  if (!line) return [""];
  const words = line.split(" ");
  const wrapped: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, FONT_SIZE) > maxWidth && current) {
      wrapped.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) wrapped.push(current);
  return wrapped;
}

// Berilgan matnni bitta yoki bir nechta sahifaga (kerak bo'lsa) chizib,
// `doc`ga to'g'ridan-to'g'ri qo'shadi — shu bilan `textToPdf` (yangi
// hujjat) va `applyPdfEdit` (mavjud hujjatga qo'shish) bir xil chizish
// mantig'ini qayta ishlatadi.
function appendTextPages(doc: PDFDocument, font: PDFFont, boldFont: PDFFont, rawText: string, title?: string) {
  const text = sanitizeForPdf(rawText);
  const maxWidth = PAGE_WIDTH - MARGIN * 2;

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  if (title) {
    const cleanTitle = sanitizeForPdf(title);
    ensureSpace(TITLE_SIZE);
    page.drawText(cleanTitle, { x: MARGIN, y, size: TITLE_SIZE, font: boldFont });
    y -= TITLE_SIZE * 1.8;
  }

  for (const paragraph of text.split("\n")) {
    for (const line of wrapLine(paragraph, font, maxWidth)) {
      ensureSpace(LINE_HEIGHT);
      page.drawText(line, { x: MARGIN, y, size: FONT_SIZE, font });
      y -= LINE_HEIGHT;
    }
  }
}

export async function textToPdf(rawText: string, title?: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  appendTextPages(doc, font, boldFont, rawText, title);
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

// Asl PDF'dagi `pageNumbers` (1-indeksli) sahifalarini `newText` bilan
// almashtiradi, QOLGAN barcha sahifalarni bayt darajasida asl holicha
// saqlaydi. `pageNumbers` bo'sh yoki hammasi yaroqsiz bo'lsa, xavfsizlik
// uchun birinchi sahifa almashtiriladi deb hisoblanadi (aks holda
// o'zgartirish hech qayerga qo'llanilmay qolardi).
export async function applyPdfEdit(
  originalBytes: Buffer,
  pageNumbers: number[],
  newText: string
): Promise<Buffer> {
  const original = await PDFDocument.load(originalBytes);
  const totalPages = original.getPageCount();

  const affected = new Set(
    pageNumbers.filter((n) => Number.isInteger(n) && n >= 1 && n <= totalPages).map((n) => n - 1)
  );
  if (affected.size === 0) affected.add(0);
  const firstAffected = Math.min(...affected);

  const output = await PDFDocument.create();
  const font = await output.embedFont(StandardFonts.Helvetica);
  const boldFont = await output.embedFont(StandardFonts.HelveticaBold);

  for (let i = 0; i < totalPages; i++) {
    if (affected.has(i)) {
      if (i === firstAffected) {
        appendTextPages(output, font, boldFont, newText);
      }
      continue; // boshqa ta'sirlangan sahifalar shu bitta blokka birlashtiriladi
    }
    const [copiedPage] = await output.copyPages(original, [i]);
    output.addPage(copiedPage);
  }

  const bytes = await output.save();
  return Buffer.from(bytes);
}
