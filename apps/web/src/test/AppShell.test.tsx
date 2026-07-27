import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "../components/AppShell";

describe("AppShell Component", () => {
  it("renders view title, sidebar groups, and View-as role switcher", async () => {
    const handleRoleChange = vi.fn();

    render(
      <AppShell title="Plan Cycle Queue" onRoleChange={handleRoleChange}>
        <div>Main Dashboard Content</div>
      </AppShell>
    );

    // Header & Sidebar
    expect(screen.getByRole("heading", { level: 1, name: "Plan Cycle Queue" })).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Plan Tools")).toBeInTheDocument();
    expect(screen.getByText("Firm")).toBeInTheDocument();
    expect(screen.getByText("Main Dashboard Content")).toBeInTheDocument();

    // View-as Role Switcher
    const roleSelect = screen.getByRole("combobox", { name: /View-as Role Switcher/i });
    expect(roleSelect).toHaveValue("Advisor View");

    await userEvent.selectOptions(roleSelect, "Firm Admin View");
    expect(handleRoleChange).toHaveBeenCalledWith("Firm Admin View");
  });
});
