import React from "react";
import styles from "./KpiCard.module.css";

export type KpiTone = "default" | "warning" | "danger" | "success";

export type KpiCardProps = {
  title: string;
  count: number;
  tone?: KpiTone;
  subtitle?: string;
};

const toneClassMap: Record<KpiTone, string> = {
  default: "",
  warning: styles.toneWarning,
  danger: styles.toneDanger,
  success: styles.toneSuccess,
};

export function KpiCard({
  title,
  count,
  tone = "default",
  subtitle,
}: KpiCardProps): React.ReactElement {
  const cardClass = `${styles.card} ${toneClassMap[tone]}`.trim();

  return (
    <div className={cardClass}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
      </div>
      <div className={styles.count}>{count}</div>
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
    </div>
  );
}
