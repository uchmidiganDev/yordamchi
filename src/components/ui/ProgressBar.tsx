import styles from "./ProgressBar.module.css";

type ProgressBarProps = {
  value: number;
  tone?: "primary" | "done" | "pending";
  className?: string;
};

export function ProgressBar({ value, tone = "primary", className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div
      className={[styles.track, className || ""].filter(Boolean).join(" ")}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`${styles.fill} ${styles[tone]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
