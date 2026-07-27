import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  PlanCycleQueueRow,
  PlanCycleQueueTable,
} from "../components/PlanCycleQueueTable";

describe("PlanCycleQueueTable Component", () => {
  const sampleRows: PlanCycleQueueRow[] = [
    {
      id: "CYCLE-101",
      clientName: "Starlight Wealth",
      stage: "Review",
      owner: "Martin Okorie",
      priority: "High",
      dueDate: "2026-03-31",
      isOverdue: true,
    },
    {
      id: "CYCLE-102",
      clientName: "Horizon Trust",
      stage: "Modeling",
      owner: "Jane Doe",
      priority: "Medium",
      dueDate: "2026-04-15",
      isOverdue: false,
    },
  ];

  it("renders queue table columns, rows, and Overdue badge for overdue cases", () => {
    render(<PlanCycleQueueTable rows={sampleRows} />);

    expect(screen.getByText("Starlight Wealth")).toBeInTheDocument();
    expect(screen.getByText("Horizon Trust")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Modeling")).toBeInTheDocument();

    // Assert OVERDUE badge is rendered for overdue cycle
    expect(screen.getByText("OVERDUE")).toBeInTheDocument();
  });

  it("handles clicking a case ID button", async () => {
    const onSelect = vi.fn();
    render(<PlanCycleQueueTable rows={sampleRows} onSelectCycle={onSelect} />);

    const caseButton = screen.getByRole("button", { name: "CYCLE-101" });
    await userEvent.click(caseButton);

    expect(onSelect).toHaveBeenCalledWith("CYCLE-101");
  });
});
