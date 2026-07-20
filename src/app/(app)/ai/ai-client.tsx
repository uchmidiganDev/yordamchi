"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatusTag } from "@/components/ui/StatusTag";
import { runManualAnalysis } from "@/lib/actions/ai";
import type { AnalysisView } from "@/lib/analysis";
import { formatDateUz, formatTimeUz } from "@/lib/format-date";
import { PageHeader } from "../page-header";
import listStyles from "../list.module.css";
import styles from "./ai.module.css";

const KIND_LABEL: Record<AnalysisView["kind"], string> = {
  morning: "Ertalabki",
  evening: "Kechki",
  manual: "Qo'lda",
};

function analysisDateLabel(iso: string) {
  const d = new Date(iso);
  return `${formatDateUz(d)}, ${formatTimeUz(d)}`;
}

// Tahlilning A–E bo'limlarini ko'rsatadi. JSON o'qib bo'lmagan (eski) yozuvlar
// uchun oddiy matn fallback.
function AnalysisSections({ analysis }: { analysis: AnalysisView }) {
  const c = analysis.content;
  if (!c) {
    return <p className={styles.rawText}>{analysis.raw}</p>;
  }

  return (
    <div className={styles.sections}>
      <div className={styles.section}>
        <h3 className={styles.blockTitle}>Xulosa</h3>
        <p className={styles.blockText}>{c.xulosa}</p>
      </div>

      {c.reja.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.blockTitle}>Ertangi reja</h3>
          <div className={styles.planList}>
            {c.reja.map((item, i) => (
              <div key={i} className={styles.planRow}>
                <span className={styles.planTime}>{item.vaqt || "—"}</span>
                <span className={styles.blockText}>{item.vazifa}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {c.ogohlantirishlar.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.blockTitle}>Ogohlantirishlar</h3>
          <div className={styles.warnList}>
            {c.ogohlantirishlar.map((w, i) => (
              <p key={i} className={styles.warnItem}>
                {w}
              </p>
            ))}
          </div>
        </div>
      )}

      {c.progress.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.blockTitle}>Maqsadlar progressi</h3>
          <div className={styles.goalList}>
            {c.progress.map((g, i) => (
              <div key={i}>
                <div className={styles.goalTop}>
                  <span className={styles.blockText}>{g.maqsad}</span>
                  <span className={styles.goalPct}>{g.foiz}%</span>
                </div>
                <ProgressBar value={Math.max(0, Math.min(100, g.foiz))} />
                <p className={styles.goalNote}>{g.baho}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className={styles.motivation}>{c.motivatsiya}</p>
    </div>
  );
}

export function AiClient({
  initialAnalyses,
  geminiConfigured,
  googleConnected,
}: {
  initialAnalyses: AnalysisView[];
  geminiConfigured: boolean;
  googleConnected: boolean;
}) {
  const [analyses, setAnalyses] = useState(initialAnalyses);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isRunning, startTransition] = useTransition();

  const latest = analyses[0] ?? null;
  const history = analyses.slice(1);

  function handleRun() {
    setError(null);
    startTransition(async () => {
      const res = await runManualAnalysis();
      if (res.ok) {
        setAnalyses((prev) => [res.data, ...prev]);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div>
      <PageHeader
        title="AI yordamchi"
        subtitle="Kunlik tahlil, ertangi reja va maqsadlaringiz bahosi"
      />

      <div className={styles.wrap}>
        <Card padding="16px" className={styles.runCard}>
          <div className={styles.runRow}>
            <div>
              <h2 className={styles.runTitle}>Kunlik tahlil</h2>
              <p className={styles.runHint}>
                Bugungi holat, ertangi reja, ogohlantirishlar va motivatsiya —
                Gemini tahlili bilan.
              </p>
            </div>
            <Button
              variant="primary"
              onClick={handleRun}
              disabled={isRunning || !geminiConfigured}
            >
              {isRunning ? "Tahlil qilinmoqda…" : "Hozir tahlil qil"}
            </Button>
          </div>
          {!geminiConfigured && (
            <p className={styles.warnItem}>
              GEMINI_API_KEY sozlanmagan — tahlil ishlashi uchun .env.local
              fayliga kalit qo&apos;shing.
            </p>
          )}
          {!googleConnected && (
            <p className={styles.mutedNote}>
              Google kalendar ulanmagan — band vaqtlar rejada hisobga
              olinmaydi. <Link href="/sozlamalar">Sozlamalardan ulash</Link>
            </p>
          )}
          {error && <p className={styles.errorText}>{error}</p>}
        </Card>

        {latest ? (
          <Card padding="16px">
            <div className={styles.latestHead}>
              <h2 className={styles.sectionTitle}>Joriy tahlil</h2>
              <span className={styles.metaText}>
                <StatusTag status="done">{KIND_LABEL[latest.kind]}</StatusTag>{" "}
                {analysisDateLabel(latest.createdAtISO)}
              </span>
            </div>
            <AnalysisSections analysis={latest} />
          </Card>
        ) : (
          <div className={listStyles.empty}>
            <h2>Hali tahlil yo&apos;q</h2>
            <p>
              Birinchi tahlilingiz uchun yuqoridagi &quot;Hozir tahlil qil&quot;
              tugmasini bosing.
            </p>
          </div>
        )}

        {history.length > 0 && (
          <>
            <h2 className={styles.sectionTitle}>Tahlil tarixi</h2>
            <div className={styles.historyList}>
              {history.map((a) => {
                const open = expandedId === a.id;
                return (
                  <Card key={a.id} padding="14px">
                    <button
                      type="button"
                      className={styles.historyBtn}
                      onClick={() => setExpandedId(open ? null : a.id)}
                      aria-expanded={open}
                    >
                      <span className={styles.historyDate}>
                        {analysisDateLabel(a.createdAtISO)}
                      </span>
                      <span className={styles.historyMeta}>
                        {KIND_LABEL[a.kind]}
                        <span
                          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
                        >
                          ▾
                        </span>
                      </span>
                    </button>
                    {!open && a.content && (
                      <p className={styles.historyExcerpt}>{a.content.xulosa}</p>
                    )}
                    {open && (
                      <div className={styles.historyBody}>
                        <AnalysisSections analysis={a} />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
