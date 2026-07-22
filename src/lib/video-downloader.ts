// YouTube/Instagram video havolalarini yuklab, Telegram'ga yuborishga
// tayyorlaydi. DIQQAT — bu ikkala platformaning RASMIY yuklab olish
// API'siga emas: YouTube uchun `@distube/ytdl-core` (pure JS, ffmpeg/
// Puppeteer'siz), Instagram uchun ochiq sahifa HTML'idagi `og:video` meta
// tegiga tayanadi. Ikkalasi ham platformalar sahifa/format tuzilmasini
// o'zgartirsa yoki himoyani kuchaytirsa ISHLAMAY QOLISHI mumkin bo'lgan
// "eng yaxshi urinish" (best-effort) yechim — rasmiy kafolatlangan xizmat
// emas. Instagram ayniqsa mo'rt: faqat ochiq (login talab qilmaydigan)
// postlar uchun ishlaydi.

import ytdl from "@distube/ytdl-core";

// Telegram bot API to'g'ridan-to'g'ri fayl yuklashda ~50MB chegara qo'yadi —
// xavfsizlik zaxirasi bilan pastroq chegara ishlatiladi.
const MAX_VIDEO_BYTES = 45 * 1024 * 1024;

export type VideoLinkKind = "youtube" | "instagram" | null;

// Butun xabar faqat bitta YouTube yoki Instagram havolasidan iborat
// bo'lsagina video-yuklab-berish sifatida qabul qilinadi.
export function detectVideoLink(text: string): VideoLinkKind {
  const trimmed = text.trim();
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return null;
  if (/(?:youtube\.com|youtu\.be)/i.test(trimmed)) return "youtube";
  if (/instagram\.com/i.test(trimmed)) return "instagram";
  return null;
}

export type DownloadedVideo = { buffer: Buffer; filename: string };

export async function downloadYoutubeVideo(url: string): Promise<DownloadedVideo> {
  if (!ytdl.validateURL(url)) {
    throw new Error("Bu yaroqli YouTube havolasi emas");
  }

  const info = await ytdl.getInfo(url);
  const formats = ytdl.filterFormats(info.formats, "audioandvideo");
  if (formats.length === 0) {
    throw new Error("Bu video uchun audio+video birlashgan format topilmadi");
  }

  // Audio+video birlashgan formatlar odatda 360p'gacha bo'ladi (YouTube
  // yuqori sifatni video/audio alohida oqim sifatida beradi, ularni
  // birlashtirish ffmpeg talab qiladi — bu loyihada ataylab ishlatilmaydi).
  // Shu sabab eng kichigini tanlaymiz: tezroq va hajm chegarasiga mos.
  const format = formats.reduce((smallest, f) =>
    Number(f.contentLength || Infinity) < Number(smallest.contentLength || Infinity) ? f : smallest
  );

  const declaredLength = Number(format.contentLength || 0);
  if (declaredLength > MAX_VIDEO_BYTES) {
    throw new Error("Video hajmi juda katta (50MB dan oshadi)");
  }

  const res = await fetch(format.url);
  if (!res.ok) {
    throw new Error(`Videoni yuklab bo'lmadi (${res.status})`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_VIDEO_BYTES) {
    throw new Error("Video hajmi juda katta (50MB dan oshadi)");
  }

  const safeTitle = info.videoDetails.title.replace(/[^\w\- ]/g, "").trim().slice(0, 60);
  return { buffer, filename: `${safeTitle || "video"}.mp4` };
}

export async function downloadInstagramVideo(url: string): Promise<DownloadedVideo> {
  const pageRes = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
    },
  });
  if (!pageRes.ok) {
    throw new Error(`Instagram sahifasini ochib bo'lmadi (${pageRes.status})`);
  }
  const html = await pageRes.text();
  const match = html.match(/<meta property="og:video" content="([^"]+)"/);
  if (!match) {
    throw new Error(
      "Bu Instagram post'dan video topilmadi — post yopiq/himoyalangan yoki login talab qilishi mumkin"
    );
  }
  const videoUrl = match[1].replace(/&amp;/g, "&");

  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) {
    throw new Error(`Videoni yuklab bo'lmadi (${videoRes.status})`);
  }
  const declaredLength = Number(videoRes.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_VIDEO_BYTES) {
    throw new Error("Video hajmi juda katta (50MB dan oshadi)");
  }
  const buffer = Buffer.from(await videoRes.arrayBuffer());
  if (buffer.length > MAX_VIDEO_BYTES) {
    throw new Error("Video hajmi juda katta (50MB dan oshadi)");
  }

  return { buffer, filename: "instagram-video.mp4" };
}

export async function downloadVideoFromLink(
  url: string,
  kind: VideoLinkKind
): Promise<DownloadedVideo> {
  if (kind === "youtube") return downloadYoutubeVideo(url);
  if (kind === "instagram") return downloadInstagramVideo(url);
  throw new Error("Qo'llab-quvvatlanmaydigan havola turi");
}
