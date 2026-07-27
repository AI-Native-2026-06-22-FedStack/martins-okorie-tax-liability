import React from "react";
import styles from "./DataTable.module.css";

export type ColumnDef<T> = {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  align?: "left" | "center" | "right";
};

export type DataTableProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
  ariaLabel?: string;
};

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  emptyMessage = "No items to display.",
  ariaLabel = "Data table",
}: DataTableProps<T>): React.ReactElement {
  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table} aria-label={ariaLabel}>
        <thead>
          <tr className={styles.tr}>
            {columns.map((col) => (
              <th
                key={col.key}
                className={styles.th}
                style={{ textAlign: col.align || "left" }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr className={styles.tr}>
              <td colSpan={columns.length} className={styles.td}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr key={keyExtractor(item)} className={styles.tr}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={styles.td}
                    style={{ textAlign: col.align || "left" }}
                  >
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
