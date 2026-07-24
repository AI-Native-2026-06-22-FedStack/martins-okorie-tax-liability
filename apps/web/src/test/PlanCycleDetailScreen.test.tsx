import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { usePlanCycleDetail } from "../hooks/usePlanCycleDetail";
import { PlanCycleDetailScreen } from "../screens/PlanCycleDetailScreen";

function PlanCycleDetailTestWrapper() {
  const detail = usePlanCycleDetail({ initialStage: "Review" });
  return <PlanCycleDetailScreen detail={detail} />;
}

describe("PlanCycleDetailScreen Component", () => {
  it("renders stage stepper highlighting current stage and Overview panel by default", () => {
    render(<PlanCycleDetailTestWrapper />);

    expect(screen.getByRole("heading", { level: 1, name: /Case Detail:/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Stage Stepper")).toBeInTheDocument();
    expect(screen.getByRole("tabpanel", { name: "Overview Panel" })).toBeInTheDocument();
    expect(screen.getByText("Assigned Advisor")).toBeInTheDocument();
  });

  it("switches to Comments tab and posts a comment", async () => {
    render(<PlanCycleDetailTestWrapper />);

    const commentsTab = screen.getByRole("tab", { name: /Comments/i });
    await userEvent.click(commentsTab);

    expect(screen.getByRole("tabpanel", { name: "Comments Panel" })).toBeInTheDocument();

    const input = screen.getByLabelText("Add Comment Input");
    await userEvent.type(input, "Verified tax liability figures.");

    const postButton = screen.getByRole("button", { name: "Post Comment" });
    await userEvent.click(postButton);

    expect(screen.getByText("Verified tax liability figures.")).toBeInTheDocument();
  });

  it("switches to Audit Trail tab and displays audit log entries", async () => {
    render(<PlanCycleDetailTestWrapper />);

    const auditTab = screen.getByRole("tab", { name: /Audit Trail/i });
    await userEvent.click(auditTab);

    expect(screen.getByRole("tabpanel", { name: "Audit Trail Panel" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Audit Trail Table" })).toBeInTheDocument();
    expect(screen.getByText("Transitioned to Modeling")).toBeInTheDocument();
  });
});
