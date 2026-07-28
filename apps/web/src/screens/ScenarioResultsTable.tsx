import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import React, { useMemo, useState } from "react";
import { QueueEmpty, QueueError, QueueSkeleton } from "../atoms/QueueStates";
import { PlanCycleQueueRow } from "../components/PlanCycleQueueTable";
import { usePlanCycleQueue } from "../api/usePlanCycles";
import { AuthSessionReturn } from "../hooks/useAuthSession";
import tableStyles from "../components/DataTable.module.css";
import queueStyles from "./PlanCycleQueueScreen.module.css";

export type ScenarioResultsTableProps = {
  auth: AuthSessionReturn;
  onEditRow?: (id: string) => void;
  onOpenRow?: (id: string) => void;
  onRemoveRow?: (id: string) => void;
};

function sortLabel(isSorted: false | "asc" | "desc"): "none" | "ascending" | "descending" {
  if (isSorted === "asc") {
    return "ascending";
  }

  if (isSorted === "desc") {
    return "descending";
  }

  return "none";
}

export function ScenarioResultsTable({
  auth,
  onEditRow,
  onOpenRow,
  onRemoveRow,
}: ScenarioResultsTableProps): React.ReactElement {
  const query = usePlanCycleQueue(auth);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<PlanCycleQueueRow>[]>(
    () => [
      {
        accessorKey: "id",
        header: "Case ID",
      },
      {
        accessorKey: "clientName",
        header: "Client",
      },
      {
        accessorKey: "stage",
        header: "Stage",
      },
      {
        accessorKey: "owner",
        header: "Owner",
      },
      {
        accessorKey: "priority",
        header: "Priority",
      },
      {
        accessorKey: "dueDate",
        header: "Due Date",
      },
      {
        cell: ({ row }) => {
          const id = row.original.id;
          return (
            <div className={queueStyles.pageButtons}>
              <button type="button" className={queueStyles.pageButton} onClick={() => onOpenRow?.(id)}>
                Open
              </button>
              <button type="button" className={queueStyles.pageButton} onClick={() => onEditRow?.(id)}>
                Edit
              </button>
              <button type="button" className={queueStyles.pageButton} onClick={() => onRemoveRow?.(id)}>
                Remove
              </button>
            </div>
          );
        },
        enableColumnFilter: false,
        enableSorting: false,
        header: "Actions",
        id: "actions",
      },
    ],
    [onEditRow, onOpenRow, onRemoveRow]
  );

  const table = useReactTable({
    columns,
    data: query.data ?? [],
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    onSortingChange: setSorting,
    state: {
      columnFilters,
      sorting,
    },
  });

  const clientFilter = String(table.getColumn("clientName")?.getFilterValue() ?? "");

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

  if ((query.data ?? []).length === 0) {
    return <QueueEmpty message="No scenario results are available." />;
  }

  return (
    <div className={queueStyles.screenContainer}>
      <div className={queueStyles.tableHeaderSection}>
        <h2 className={queueStyles.sectionTitle}>Scenario Results</h2>
        <label htmlFor="scenario-results-filter">Filter by client</label>
        <input
          id="scenario-results-filter"
          type="search"
          value={clientFilter}
          onChange={(event) => table.getColumn("clientName")?.setFilterValue(event.target.value)}
        />
      </div>

      <div className={tableStyles.tableWrapper}>
        <table className={tableStyles.table} aria-label="Scenario Results Table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className={tableStyles.tr}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortState = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      aria-sort={canSort ? sortLabel(sortState) : undefined}
                      className={tableStyles.th}
                      scope="col"
                    >
                      {canSort ? (
                        <button type="button" onClick={header.column.getToggleSortingHandler()}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={tableStyles.tr}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={tableStyles.td}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={queueStyles.paginationBar}>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <div className={queueStyles.pageButtons}>
          <button
            type="button"
            className={queueStyles.pageButton}
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Previous
          </button>
          <button
            type="button"
            className={queueStyles.pageButton}
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
