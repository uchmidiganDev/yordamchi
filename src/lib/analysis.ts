// AI tahlil natijasining umumiy turlari va parseri. `analyses.content`
// ustunida JSON matn sifatida saqlanadi; server ham, klient ham shu turlar
// bilan ishlaydi.

export type PlanItem = {
  vaqt?: string; // "HH:MM" (taxminiy)
  vazifa: string;
};

export type GoalProgressItem = {
  maqsad: string;
  foiz: number;
  baho: string; // sur'at bahosi (qisqa izoh)
};

// A–E funksiyalar natijasi: xulosa (A), reja (B), ogohlantirishlar (C),
// progress (D), motivatsiya (E).
export type AnalysisContent = {
  xulosa: string;
  reja: PlanItem[];
  ogohlantirishlar: string[];
  progress: GoalProgressItem[];
  motivatsiya: string;
};

export type AnalysisView = {
  id: string;
  kind: "morning" | "evening" | "manual";
  createdAtISO: string;
  content: AnalysisContent | null; // null — JSON emas (eski/oddiy matn)
  raw: string;
};

export function parseAnalysisContent(raw: string): AnalysisContent | null {
  try {
    const p = JSON.parse(raw) as Partial<AnalysisContent>;
    if (typeof p.xulosa !== "string" || typeof p.motivatsiya !== "string") {
      return null;
    }
    return {
      xulosa: p.xulosa,
      reja: Array.isArray(p.reja)
        ? p.reja.filter((r) => r && typeof r.vazifa === "string")
        : [],
      ogohlantirishlar: Array.isArray(p.ogohlantirishlar)
        ? p.ogohlantirishlar.filter((o) => typeof o === "string")
        : [],
      progress: Array.isArray(p.progress)
        ? p.progress.filter(
            (g) =>
              g &&
              typeof g.maqsad === "string" &&
              typeof g.foiz === "number" &&
              typeof g.baho === "string"
          )
        : [],
      motivatsiya: p.motivatsiya,
    };
  } catch {
    return null;
  }
}
