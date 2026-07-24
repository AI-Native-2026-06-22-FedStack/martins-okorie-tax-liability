import React from "react";
import { KpiCard } from "../atoms/KpiCard";
import { QueueEmpty, QueueError, QueueSkeleton } from "../atoms/QueueStates";
import { AppShell } from "../components/AppShell";
import {
  PlanCycleQueueRow,
  PlanCycleQueueTable,
} from "../components/PlanCycleQueueTable";
import styles from "./PlanCycleQueueScreen.module.css";

export type ScreenState = "success" | "loading" | "empty" | "error";

export type PlanCycleQueueScreenProps = {
  rows?: PlanCycleQueueRow[];
  state?: ScreenState;
  errorMessage?: string;
  activeRole?: "Advisor View" | "Firm Admin View";
  onRetry?: () => void;
  onSelectCycle?: (id: string) => void;
  onLogout?: () => void;
};

export const defaultMockRows: PlanCycleQueueRow[] = [
  {
    id: "CYCLE-2026-Q1-001",
    clientName: "Acme Wealth Management",
    stage: "Review",
    owner: "Martin Okorie",
    priority: "High",
    dueDate: "2026-03-31",
    isOverdue: true,
  },
  {
    id: "CYCLE-2026-Q1-002",
    clientName: "Vanguard Partners",
    stage: "Modeling",
    owner: "Sarah Jenkins",
    priority: "Medium",
    dueDate: "2026-04-15",
    isOverdue: false,
  },
  {
    id: "CYCLE-2026-Q1-003",
    clientName: "Beacon Family Office",
    stage: "Client Approval",
    owner: "Martin Okorie",
    priority: "High",
    dueDate: "2026-03-15",
    isOverdue: true,
  },
  {
    id: "CYCLE-2026-Q1-004",
    clientName: "Crestview Holdings",
    stage: "Intake",
    owner: "Alex Mercer",
    priority: "Low",
    dueDate: "2026-04-30",
    isOverdue: false,
  },
];

export function PlanCycleQueueScreen({
  rows = defaultMockRows,
  state = "success",
  errorMessage,
  activeRole = "Advisor View",
  onRetry,
  onSelectCycle,
  onLogout,
}: PlanCycleQueueScreenProps): React.ReactElement {
  const activeRows = rows;
  const overdueCount = activeRows.filter((r) => r.isOverdue).length;
  const reviewCount = activeRows.filter((r) => r.stage === "Review").length;

  return (
    <AppShell title="Plan Cycle Queue" activeRole={activeRole} onLogout={onLogout}>
      <div className={styles.screenContainer}>
        {/* KPI Cards Row */}
        <div className={styles.kpiGrid}>
          <KpiCard title="Open Cycles" count={activeRows.length} />
          <KpiCard
            title="Awaiting Review"
            count={reviewCount}
            subtitle="Requires Firm Admin signoff"
          />
          <KpiCard
            title="Overdue Cycles"
            count={overdueCount}
            tone={overdueCount > 0 ? "danger" : "default"}
            subtitle="Past target completion date"
          />
          <KpiCard
            title="Presented This Week"
            count={5}
            tone="success"
            subtitle="Client meetings held"
          />
        </div>

        {/* Main Queue Section */}
        <div className={styles.tableHeaderSection}>
          <h2 className={styles.sectionTitle}>Active Plan Cycles</h2>
        </div>

        {/* State-driven Presentational Rendering */}
        {state === "loading" && <QueueSkeleton />}
        {state === "empty" && <QueueEmpty />}
        {state === "error" && (
          <QueueError message={errorMessage} onRetry={onRetry} />
        )}
        {state === "success" && (
          <PlanCycleQueueTable rows={activeRows} onSelectCycle={onSelectCycle} />
        )}
      </div>
    </AppShell>
  );
}
