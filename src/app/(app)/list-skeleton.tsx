import styles from "./skeleton.module.css";

// Ro'yxat sahifalari uchun umumiy yuklanish holati (skeleton). Server komponent
// ma'lumot olayotganda Suspense fallback sifatida ko'rsatiladi.
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div>
      <div className={styles.head}>
        <div className={styles.line} style={{ width: 180, height: 28 }} />
        <div className={styles.line} style={{ width: 240, height: 14 }} />
      </div>
      <div className={styles.wrap}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={styles.card} />
        ))}
      </div>
    </div>
  );
}
