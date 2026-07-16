import styles from "./page-header.module.css";

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className={styles.head}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.subtitle}>{subtitle}</p>
    </div>
  );
}
