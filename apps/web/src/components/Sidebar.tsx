import React from "react";
import styles from "./Sidebar.module.css";

export type NavItem = {
  id: string;
  label: string;
  active?: boolean;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export type SidebarProps = {
  activeItemId?: string;
  onSelectNav?: (id: string) => void;
};

const defaultGroups: NavGroup[] = [
  {
    title: "Workspace",
    items: [
      { id: "dashboard", label: "Dashboard" },
      { id: "queue", label: "Plan Cycle Queue", active: true },
      { id: "clients", label: "Active Clients" },
      { id: "tasks", label: "Action Items" },
    ],
  },
  {
    title: "Plan Tools",
    items: [
      { id: "modeler", label: "Scenario Modeler" },
      { id: "brackets", label: "Tax Bracket Tables" },
      { id: "calculator", label: "Liability Calculator" },
    ],
  },
  {
    title: "Firm",
    items: [
      { id: "settings", label: "Firm Settings" },
      { id: "team", label: "Team Members" },
      { id: "audit", label: "Audit Logs" },
    ],
  },
];

export function Sidebar({
  activeItemId = "queue",
  onSelectNav,
}: SidebarProps): React.ReactElement {
  return (
    <aside className={styles.sidebar} aria-label="Sidebar navigation">
      <div className={styles.brand}>
        <span>TaxPulse Advisory</span>
      </div>

      {defaultGroups.map((group) => (
        <div key={group.title} className={styles.navGroup}>
          <div className={styles.groupLabel}>{group.title}</div>
          {group.items.map((item) => {
            const isActive = item.id === activeItemId;
            const itemClass = `${styles.navItem} ${
              isActive ? styles.navItemActive : ""
            }`.trim();

            return (
              <button
                key={item.id}
                type="button"
                className={itemClass}
                onClick={() => onSelectNav?.(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
