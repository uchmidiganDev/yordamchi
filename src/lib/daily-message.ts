// AI tahlil natijasini (AnalysisContent) Telegram uchun o'qish qulay matn
// ko'rinishiga o'giradi — ertalabki va kechqurungi cron xabarlari uchun
// (src/app/api/cron/daily-analysis). Plain matn (parse_mode'siz) ishlatiladi
// — website-analyzer/code-assistant'dagi kabi HTML/Markdown escape muammosi
// bu yerda xavf emas (AI matni erkin, kod/belgilar yo'q), shuning uchun
// eng oddiy va ishonchli yo'l.

import type { AnalysisContent } from "./analysis";
import { formatDateStrUz } from "./format-date";

function formatPlan(items: AnalysisContent["reja"]): string {
  if (items.length === 0) return "(hozircha rejalashtirilgan vazifa yo'q)";
  return items
    .map((item) => `${item.vaqt ? `${item.vaqt} — ` : "• "}${item.vazifa}`)
    .join("\n");
}

function formatWarnings(items: string[]): string {
  return items.map((w) => `⚠️ ${w}`).join("\n");
}

function formatProgress(items: AnalysisContent["progress"]): string {
  return items.map((p) => `• ${p.maqsad}: ${p.foiz}% — ${p.baho}`).join("\n");
}

export function formatDailyMessage(
  kind: "morning" | "evening",
  content: AnalysisContent,
  todayStr: string
): string {
  const dateLabel = formatDateStrUz(todayStr);
  const parts: string[] = [];

  if (kind === "morning") {
    parts.push(`☀️ Xayrli tong! — ${dateLabel}`, "", content.xulosa);
    parts.push("", "🗓 Bugungi reja:", formatPlan(content.reja));
  } else {
    parts.push(`🌙 Kechqurungi hisobot — ${dateLabel}`, "", content.xulosa);
    parts.push("", "🗓 Ertangi reja:", formatPlan(content.reja));
  }

  if (content.ogohlantirishlar.length > 0) {
    parts.push("", formatWarnings(content.ogohlantirishlar));
  }
  if (content.progress.length > 0) {
    parts.push("", "📊 Maqsadlar:", formatProgress(content.progress));
  }

  parts.push("", `💪 ${content.motivatsiya}`);

  const text = parts.join("\n");
  return text.length > 4000 ? `${text.slice(0, 3990)}…` : text;
}
