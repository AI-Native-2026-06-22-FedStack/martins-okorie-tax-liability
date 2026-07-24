import React, { memo, useMemo } from "react";
import { Badge, BadgeVariant } from "../atoms/Badge";
import { ColumnDef, DataTable } from "./DataTable";
import styles from "./PlanCycleQueueTable.module.css";

export type PlanCycleStage =
  | "Intake"
  | "Data Aggregation"
  | "Modeling"
  | "Review"
  | "Client Approval"
  | "Executed"
  | "Archived";

export type PlanCycleQueueRow = {
  id: string;
  clientName: string;
  stage: PlanCycleStage;
  owner: string;
  priority: "High" | "Medium" | "Low";
  dueDate: string;
  isOverdue?: boolean;
};

export type PlanCycleQueueTableProps = {
  rows: PlanCycleQueueRow[];
  onSelectCycle?: (id: string) => void;
};

const stageToBadgeVariant: Record<PlanCycleStage, BadgeVariant> = {
  Intake: "draft",
  "Data Aggregation": "draft",
  Modeling: "submitted",
  Review: "in_review",
  "Client Approval": "submitted",
  Executed: "approved",
  Archived: "approved",
};

export const PlanCycleQueueTable = memo(function PlanCycleQueueTable({
  rows,
  onSelectCycle,
}: PlanCycleQueueTableProps): React.ReactElement {
  const columns: ColumnDef<PlanCycleQueueRow>[] = useMemo(
    () => [
      {
        key: "id",
        header: "Case ID",
        render: (row) => (
          <button
            type="button"
            className={styles.caseId}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            onClick={() => onSelectCycle?.(row.id)}
          >
            {row.id}
          </button>
        ),
      },
      {
        key: "clientName",
        header: "Client",
        render: (row) => <span className={styles.clientName}>{row.clientName}</span>,
      },
      {
        key: "stage",
        header: "Stage",
        render: (row) => (
          <Badge variant={stageToBadgeVariant[row.stage]} label={row.stage} />
        ),
      },
      {
        key: "owner",
        header: "Owner",
        render: (row) => row.owner,
      },
      {
        key: "priority",
        header: "Priority",
        render: (row) => row.priority,
      },
      {
        key: "dueDate",
        header: "Due Date",
        render: (row) => (
          <div className={styles.dueDateCell}>
            <span className={row.isOverdue ? styles.overdueText : ""}>
              {row.dueDate}
            </span>
            {row.isOverdue && <Badge variant="overdue" label="OVERDUE" />}
          </div>
        ),
      },
    ],
    [onSelectCycle]
  );

  return (
    <DataTable
      data={rows}
      columns={columns}
      keyExtractor={(row) => row.id}
      ariaLabel="Plan Cycle Queue Table"
    />
  );
});
