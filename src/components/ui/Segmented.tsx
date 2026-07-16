"use client";

import styles from "./Segmented.module.css";

type Option<T extends string> = { value: T; label: string };

type SegmentedProps<T extends string> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className={styles.seg}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          className={`${styles.btn} ${value === opt.value ? styles.on : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
