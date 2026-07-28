import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import React from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { KpiCard, KpiTone } from "../atoms/KpiCard";
import { QueueEmpty, QueueError, QueueSkeleton } from "../atoms/QueueStates";
import { usePlanCycleQueue } from "../api/usePlanCycles";
import { PlanCycleQueueRow, PlanCycleStage } from "../components/PlanCycleQueueTable";
import { AuthSessionReturn } from "../hooks/useAuthSession";
import tableStyles from "../components/DataTable.module.css";
import styles from "./PlanCycleQueueScreen.module.css";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
);

export type DashboardChartPoint = {
  label: string;
  value: number;
};

export type DashboardModel = {
  estimatedTaxByQuarter: DashboardChartPoint[];
  incomeBreakdown: DashboardChartPoint[];
  kpis: DashboardChartPoint[];
  taxBreakdown: DashboardChartPoint[];
  yearOverYear: DashboardChartPoint[];
};

const quarters = ["Q1", "Q2", "Q3", "Q4"] as const;
const stages: PlanCycleStage[] = [
  "Intake",
  "Data Aggregation",
  "Modeling",
  "Review",
  "Client Approval",
  "Executed",
  "Archived",
];
const priorities = ["High", "Medium", "Low", "Overdue"] as const;
const chartColors = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#4b5563"];

function quarterForDate(date: string): (typeof quarters)[number] {
  const month = Number(date.slice(5, 7));
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
}

function yearForDate(date: string): string {
  return date.slice(0, 4);
}

function countByLabels<TLabel extends string>(
  labels: readonly TLabel[],
  rows: PlanCycleQueueRow[],
  labelForRow: (row: PlanCycleQueueRow) => TLabel | null
): DashboardChartPoint[] {
  const counts = new Map<TLabel, number>(labels.map((label) => [label, 0]));
  rows.forEach((row) => {
    const label = labelForRow(row);
    if (label) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  });

  return labels.map((label) => ({
    label,
    value: counts.get(label) ?? 0,
  }));
}

export function buildDashboardModel(rows: PlanCycleQueueRow[]): DashboardModel {
  const estimatedTaxByQuarter = countByLabels(quarters, rows, (row) => quarterForDate(row.dueDate));
  const incomeBreakdown = countByLabels(stages, rows, (row) => row.stage);
  const taxBreakdown = countByLabels(priorities, rows, (row) =>
    row.isOverdue ? "Overdue" : row.priority
  );
  const years = Array.from(new Set(rows.map((row) => yearForDate(row.dueDate)))).sort();
  const yearOverYear = countByLabels(years, rows, (row) => yearForDate(row.dueDate));

  return {
    estimatedTaxByQuarter,
    incomeBreakdown,
    kpis: estimatedTaxByQuarter,
    taxBreakdown,
    yearOverYear,
  };
}

function chartSummary(title: string, points: DashboardChartPoint[]): string {
  const values = points.map((point) => `${point.label}: ${point.value}`).join(", ");
  return `${title}. ${values}.`;
}

function chartData(points: DashboardChartPoint[], label: string) {
  return {
    labels: points.map((point) => point.label),
    datasets: [
      {
        backgroundColor: points.map((_point, index) => chartColors[index % chartColors.length]),
        borderColor: "#111827",
        data: points.map((point) => point.value),
        label,
      },
    ],
  };
}

function lineData(points: DashboardChartPoint[], label: string) {
  return {
    labels: points.map((point) => point.label),
    datasets: [
      {
        backgroundColor: "#2563eb",
        borderColor: "#2563eb",
        data: points.map((point) => point.value),
        label,
        pointStyle: "circle" as const,
      },
    ],
  };
}

function toneForQuarter(point: DashboardChartPoint): KpiTone {
  if (point.value === 0) return "default";
  if (point.value >= 3) return "warning";
  return "success";
}

function ChartAlternative({
  points,
  title,
}: {
  points: DashboardChartPoint[];
  title: string;
}): React.ReactElement {
  return (
    <table className={tableStyles.table} aria-label={`${title} data table`} tabIndex={0}>
      <thead>
        <tr className={tableStyles.tr}>
          <th className={tableStyles.th} scope="col">
            Label
          </th>
          <th className={tableStyles.th} scope="col">
            Count
          </th>
        </tr>
      </thead>
      <tbody>
        {points.map((point) => (
          <tr key={point.label} className={tableStyles.tr}>
            <td className={tableStyles.td}>{point.label}</td>
            <td className={tableStyles.td}>{point.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChartSection({
  children,
  points,
  title,
}: {
  children: React.ReactNode;
  points: DashboardChartPoint[];
  title: string;
}): React.ReactElement {
  return (
    <section className={tableStyles.tableWrapper} aria-label={title}>
      <div className={styles.tableHeaderSection} style={{ padding: "var(--space-4)" }}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <span>{chartSummary(title, points)}</span>
      </div>
      <div style={{ padding: "0 var(--space-4) var(--space-4)" }}>{children}</div>
      <ChartAlternative points={points} title={title} />
    </section>
  );
}

export function Dashboard({ auth }: { auth: AuthSessionReturn }): React.ReactElement {
  const query = usePlanCycleQueue(auth);

  if (query.isPending) {
    return <QueueSkeleton />;
  }

  if (query.isError) {
    return (
      <QueueError
        message={query.error.message}
        onRetry={() => {
          const retry = query.refetch;
          void retry();
        }}
      />
    );
  }

  const rows = query.data ?? [];
  if (rows.length === 0) {
    return <QueueEmpty message="No dashboard data is available." />;
  }

  const model = buildDashboardModel(rows);

  return (
    <div className={styles.screenContainer}>
      <div className={styles.kpiGrid}>
        {model.kpis.map((point) => (
          <KpiCard
            key={point.label}
            count={point.value}
            subtitle="Plan cycles by due-date quarter"
            title={`${point.label} Quarterly Payments`}
            tone={toneForQuarter(point)}
          />
        ))}
      </div>

      <ChartSection points={model.estimatedTaxByQuarter} title="Estimated-Tax-by-Quarter">
        <Bar
          aria-label={chartSummary("Estimated-Tax-by-Quarter", model.estimatedTaxByQuarter)}
          data={chartData(model.estimatedTaxByQuarter, "Plan cycles")}
        />
      </ChartSection>

      <ChartSection points={model.incomeBreakdown} title="Income Breakdown">
        <Doughnut
          aria-label={chartSummary("Income Breakdown", model.incomeBreakdown)}
          data={chartData(model.incomeBreakdown, "Workflow stages")}
        />
      </ChartSection>

      <ChartSection points={model.taxBreakdown} title="Tax Breakdown">
        <Doughnut
          aria-label={chartSummary("Tax Breakdown", model.taxBreakdown)}
          data={chartData(model.taxBreakdown, "Priority and overdue")}
        />
      </ChartSection>

      <ChartSection points={model.yearOverYear} title="Year-over-Year">
        <Line
          aria-label={chartSummary("Year-over-Year", model.yearOverYear)}
          data={lineData(model.yearOverYear, "Plan cycles")}
        />
      </ChartSection>
    </div>
  );
}

export { Dashboard as DashboardScreen };
