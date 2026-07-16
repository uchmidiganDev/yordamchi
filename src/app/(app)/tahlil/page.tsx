import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { getAnalytics } from "@/lib/actions/analytics";
import { PageHeader } from "../page-header";
import styles from "./tahlil.module.css";

export default async function TahlilPage() {
  const { week, goalBreakdown, stats } = await getAnalytics();

  return (
    <div>
      <PageHeader title="Tahlil" subtitle="Faoliyatingiz bo'yicha statistik ko'rinish" />

      <div className={styles.wrap}>
        <div className={styles.statsRow}>
          {stats.map((s) => (
            <Card key={s.label} padding="14px" className={styles.statCard}>
              <div className={styles.statValue}>{s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </Card>
          ))}
        </div>

        <Card padding="16px">
          <h2 className={styles.sectionTitle}>Haftalik faollik</h2>
          <p className={styles.hint}>Muddati shu haftaga to&apos;g&apos;ri kelgan vazifalarning bajarilish foizi</p>
          <div className={styles.chart}>
            {week.map((d) => (
              <div key={d.day} className={styles.chartCol}>
                <div className={styles.chartBarTrack}>
                  <div className={styles.chartBar} style={{ height: `${d.pct}%` }} />
                </div>
                <span className={styles.chartLabel}>{d.day}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card padding="16px">
          <h2 className={styles.sectionTitle}>Maqsadlar bo&apos;yicha taraqqiyot</h2>
          {goalBreakdown.length === 0 ? (
            <p className={styles.hint}>Hali faol maqsad yo&apos;q</p>
          ) : (
            <div className={styles.goalList}>
              {goalBreakdown.map((g) => (
                <div key={g.title} className={styles.goalRow}>
                  <div className={styles.goalTop}>
                    <span>{g.title}</span>
                    <span className={styles.goalPct}>{g.progress}%</span>
                  </div>
                  <ProgressBar value={g.progress} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
