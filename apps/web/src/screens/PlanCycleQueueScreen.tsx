import React, { useCallback, useMemo, useState, useTransition } from "react";
import { KpiCard } from "../atoms/KpiCard";
import { QueueEmpty, QueueError, QueueSkeleton } from "../atoms/QueueStates";
import { AppShell } from "../components/AppShell";
import {
  PlanCycleQueueRow,
  PlanCycleQueueTable,
} from "../components/PlanCycleQueueTable";
import { usePlanCycleQueue } from "../api/usePlanCycles";
import { AuthSessionReturn } from "../hooks/useAuthSession";
import { useDebounce } from "../hooks/useDebounce";
import { usePagination } from "../hooks/usePagination";
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

export type PlanCycleQueueContentProps = Omit<
  PlanCycleQueueScreenProps,
  "activeRole" | "onLogout"
>;

export type PlanCycleQueueServerScreenProps = {
  auth: AuthSessionReturn;
  activeRole?: "Advisor View" | "Firm Admin View";
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
  {
    id: "CYCLE-2026-Q1-005",
    clientName: "Pinnacle Capital",
    stage: "Data Aggregation",
    owner: "Sarah Jenkins",
    priority: "Medium",
    dueDate: "2026-05-10",
    isOverdue: false,
  },
  {
    id: "CYCLE-2026-Q1-006",
    clientName: "Summit Financial",
    stage: "Executed",
    owner: "Martin Okorie",
    priority: "High",
    dueDate: "2026-02-28",
    isOverdue: false,
  },
];

export function PlanCycleQueueContent({
  rows = defaultMockRows,
  state = "success",
  errorMessage,
  onRetry,
  onSelectCycle,
}: PlanCycleQueueContentProps): React.ReactElement {
  const [searchQuery, setSearchQuery] = useState("");
  const [, startTransition] = useTransition();

  const debouncedQuery = useDebounce(searchQuery, 300);

  // PERFORMANCE FIX (ADR-0012): Cache filtered queue rows with useMemo to prevent recomputing filtering on every search keystroke render.
  const filteredRows = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return rows;
    }
    const q = debouncedQuery.toLowerCase();
    return rows.filter(
      (r) =>
        r.clientName.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.owner.toLowerCase().includes(q) ||
        r.stage.toLowerCase().includes(q)
    );
  }, [rows, debouncedQuery]);

  const {
    currentPage,
    totalPages,
    totalItems,
    paginatedItems,
    canNextPage,
    canPrevPage,
    nextPage,
    prevPage,
  } = usePagination(filteredRows, 5);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    startTransition(() => {
      setSearchQuery(val);
    });
  };

  const handleSelectCycle = useCallback(
    (id: string) => {
      onSelectCycle?.(id);
    },
    [onSelectCycle]
  );

  const overdueCount = rows.filter((r) => r.isOverdue).length;
  const reviewCount = rows.filter((r) => r.stage === "Review").length;

  return (
    <div className={styles.screenContainer}>
      {/* KPI Cards Row */}
      <div className={styles.kpiGrid}>
        <KpiCard title="Open Cycles" count={rows.length} />
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
        <input
          type="search"
          aria-label="Search plan cycles"
          placeholder="Search by client, ID, owner..."
          className={styles.searchInput}
          value={searchQuery}
          onChange={handleSearchChange}
        />
      </div>

      {/* State-driven Presentational Rendering */}
      {state === "loading" && <QueueSkeleton />}
      {state === "empty" && <QueueEmpty />}
      {state === "error" && <QueueError message={errorMessage} onRetry={onRetry} />}
      {state === "success" && (
        <>
          <PlanCycleQueueTable rows={paginatedItems} onSelectCycle={handleSelectCycle} />
          <div className={styles.paginationBar}>
            <span>
              Showing page {currentPage} of {totalPages} ({totalItems} cycles)
            </span>
            <div className={styles.pageButtons}>
              <button
                type="button"
                className={styles.pageButton}
                onClick={prevPage}
                disabled={!canPrevPage}
                aria-label="Previous Page"
              >
                Previous
              </button>
              <button
                type="button"
                className={styles.pageButton}
                onClick={nextPage}
                disabled={!canNextPage}
                aria-label="Next Page"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function PlanCycleQueueScreen({
  activeRole = "Advisor View",
  onLogout,
  ...contentProps
}: PlanCycleQueueScreenProps): React.ReactElement {
  return (
    <AppShell title="Plan Cycle Queue" activeRole={activeRole} onLogout={onLogout}>
      <PlanCycleQueueContent {...contentProps} />
    </AppShell>
  );
}

export function PlanCycleQueueServerContent({
  auth,
  onSelectCycle,
}: Omit<PlanCycleQueueServerScreenProps, "activeRole" | "onLogout">): React.ReactElement {
  const query = usePlanCycleQueue(auth);
  const rows = query.data ?? [];

  const state: ScreenState = query.isPending
    ? "loading"
    : query.isError
    ? "error"
    : rows.length === 0
    ? "empty"
    : "success";

  return (
    <PlanCycleQueueContent
      errorMessage={query.error?.message}
      onRetry={() => {
        const retry = query.refetch;
        void retry();
      }}
      onSelectCycle={onSelectCycle}
      rows={rows}
      state={state}
    />
  );
}

export function PlanCycleQueueServerScreen({
  auth,
  activeRole,
  onSelectCycle,
  onLogout,
}: PlanCycleQueueServerScreenProps): React.ReactElement {
  return (
    <AppShell title="Plan Cycle Queue" activeRole={activeRole} onLogout={onLogout}>
      <PlanCycleQueueServerContent auth={auth} onSelectCycle={onSelectCycle} />
    </AppShell>
  );
}
