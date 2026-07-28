import React from "react";
import { KpiCard } from "../atoms/KpiCard";
import styles from "./PlanCycleQueueScreen.module.css";

export function DashboardScreen(): React.ReactElement {
  return (
    <div className={styles.screenContainer}>
      <div className={styles.kpiGrid}>
        <KpiCard title="Open Cycles" count={0} subtitle="Ready for advisor review" />
        <KpiCard title="Awaiting Review" count={0} subtitle="Tracked in plan cycle workflow" />
        <KpiCard title="Overdue Cycles" count={0} tone="default" subtitle="Past target completion date" />
        <KpiCard title="Presented This Week" count={0} tone="success" subtitle="Client meetings held" />
      </div>

      <div className={styles.tableHeaderSection}>
        <h2 className={styles.sectionTitle}>Dashboard</h2>
      </div>
    </div>
  );
}
