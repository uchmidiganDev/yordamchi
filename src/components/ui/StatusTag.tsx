import styles from "./StatusTag.module.css";

type StatusTagProps = {
  status?: "done" | "pending" | "neutral";
  children?: React.ReactNode;
  className?: string;
};

const LABELS: Record<string, string> = {
  done: "Bajarilgan",
  pending: "Kutilmoqda",
  neutral: "Holat",
};

export function StatusTag({ status = "done", children, className }: StatusTagProps) {
  return (
    <span
      className={[styles.tag, styles[status], className || ""].filter(Boolean).join(" ")}
    >
      <span className={styles.dot} />
      {children || LABELS[status]}
    </span>
  );
}
