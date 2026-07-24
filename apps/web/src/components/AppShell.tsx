import React from "react";
import styles from "./AppShell.module.css";
import { Sidebar } from "./Sidebar";

export type AppShellProps = {
  title?: string;
  activeRole?: "Advisor View" | "Firm Admin View";
  onRoleChange?: (role: "Advisor View" | "Firm Admin View") => void;
  children: React.ReactNode;
};

export function AppShell({
  title = "Plan Cycle Queue",
  activeRole = "Advisor View",
  onRoleChange,
  children,
}: AppShellProps): React.ReactElement {
  return (
    <div className={styles.layout}>
      <Sidebar activeItemId="queue" />
      <div className={styles.mainContainer}>
        <header className={styles.topbar}>
          <h1 className={styles.viewTitle}>{title}</h1>
          <div className={styles.topbarActions}>
            <select
              className={styles.roleSelect}
              value={activeRole}
              aria-label="View-as Role Switcher"
              onChange={(e) =>
                onRoleChange?.(e.target.value as "Advisor View" | "Firm Admin View")
              }
            >
              <option value="Advisor View">Advisor View</option>
              <option value="Firm Admin View">Firm Admin View</option>
            </select>
            <span className={styles.userBadge}>Martin Okorie (Advisor)</span>
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
