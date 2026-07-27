import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlanCycleQueueScreen } from "../screens/PlanCycleQueueScreen";

describe("PlanCycleQueueScreen", () => {
  it("renders 4 KPI cards and queue table in default success state", () => {
    render(<PlanCycleQueueScreen state="success" />);

    // KPI Cards
    expect(screen.getByText("Open Cycles")).toBeInTheDocument();
    expect(screen.getByText("Awaiting Review")).toBeInTheDocument();
    expect(screen.getByText("Overdue Cycles")).toBeInTheDocument();
    expect(screen.getByText("Presented This Week")).toBeInTheDocument();

    // Table Content
    expect(screen.getByText("Acme Wealth Management")).toBeInTheDocument();
    expect(screen.getByText("Beacon Family Office")).toBeInTheDocument();
  });

  it("renders loading skeleton state when state='loading'", () => {
    render(<PlanCycleQueueScreen state="loading" />);
    expect(screen.getByLabelText("Loading queue skeleton")).toBeInTheDocument();
  });

  it("renders empty queue state when state='empty'", () => {
    render(<PlanCycleQueueScreen state="empty" />);
    expect(screen.getByText("Queue is Empty")).toBeInTheDocument();
  });

  it("renders error state when state='error'", () => {
    render(
      <PlanCycleQueueScreen
        state="error"
        errorMessage="Network error reaching TaxPulse API"
      />
    );
    expect(screen.getByText("Error Loading Queue")).toBeInTheDocument();
    expect(screen.getByText("Network error reaching TaxPulse API")).toBeInTheDocument();
  });
});
