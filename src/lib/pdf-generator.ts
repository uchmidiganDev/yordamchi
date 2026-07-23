// Oddiy matndan PDF hujjat yaratadi ("/pdf" oqimida AI natijasini qayta
// PDF sifatida qaytarish uchun). `pdf-lib` ishlatiladi — sof JS/TS,
// tashqi binary/font fayl talab qilmaydi, Vercel serverless muhitida
// ffmpeg/Puppeteer'siz ishlaydi (loyihaning boshqa qismlaridagi yengil
// bog'liqlik konvensiyasiga mos).
//
// CHEKLOV: standart Helvetica shrifti WinAnsi kodlashda ishlaydi — bu
// lotin harflari (o'zbekcha, inglizcha, va h.k.) va ko'p uchraydigan
// "aqlli" tinish belgilarini (qiya tire, qo'shtirnoq) to'liq qo'llab-
// quvvatlaydi, lekin kirill, arab va boshqa lotin bo'lmagan skriptlarni
// EMAS — bunday belgilar "?" bilan almashtiriladi. To'liq Unicode uchun
// maxsus shrift (@pdf-lib/fontkit + TTF fayl) kerak bo'lardi, bu hajm/
// murakkablikni oshiradi va hozircha kerak emas deb hisoblandi.

import { PDFDocument, StandardFonts } from "pdf-lib";

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

function wrapLine(line: string, font: import("pdf-lib").PDFFont, maxWidth: number): string[] {
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

export async function textToPdf(rawText: string, title?: string): Promise<Buffer> {
  const text = sanitizeForPdf(rawText);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
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

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
