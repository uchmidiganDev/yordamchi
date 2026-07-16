"use client";

import { ReactNode, useEffect } from "react";
import styles from "./Sheet.module.css";

type SheetProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

export function Sheet({ title, subtitle, onClose, children }: SheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div className={styles.sheet} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.head}>
          <div>
            <h2 className={styles.title}>{title}</h2>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Yopish">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
