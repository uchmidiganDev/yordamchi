"use client";

import { HTMLAttributes } from "react";
import styles from "./Card.module.css";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  padding?: string;
};

export function Card({
  interactive = false,
  padding,
  className,
  style,
  ...rest
}: CardProps) {
  const classes = [styles.card, interactive ? styles.interactive : "", className || ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={{ padding: padding ?? "var(--space-4)", ...style }}
      {...rest}
    />
  );
}
