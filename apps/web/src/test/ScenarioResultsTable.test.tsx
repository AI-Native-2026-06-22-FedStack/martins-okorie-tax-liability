import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlanCycleQueue } from "../api/usePlanCycles";
import { PlanCycleQueueRow } from "../components/PlanCycleQueueTable";
import { AuthSessionReturn } from "../hooks/useAuthSession";
import { ScenarioResultsTable } from "../screens/ScenarioResultsTable";

vi.mock("../api/usePlanCycles", () => ({
  usePlanCycleQueue: vi.fn(),
}));

const auth: AuthSessionReturn = {
  authenticated: true,
  error: null,
  getAccessToken: vi.fn(() => "access_123"),
  login: vi.fn(),
  logout: vi.fn(),
  refreshSession: vi.fn(),
  resetPasswordMock: vi.fn(),
  step: "authenticated",
  submitMfa: vi.fn(),
  user: {
    email: "advisor@taxpulse.test",
    id: "usr_1",
    role: "Advisor",
    tenantId: "tenant_123",
    tenantName: "Acme Wealth",
  },
};

const rows: PlanCycleQueueRow[] = [
  {
    clientName: "Zeta Family Office",
    dueDate: "2026-09-30",
    id: "cycle_006",
    isOverdue: false,
    owner: "advisor@taxpulse.test",
    priority: "Low",
    stage: "Intake",
  },
  {
    clientName: "Acme Wealth",
    dueDate: "2026-08-31",
    id: "cycle_001",
    isOverdue: false,
    owner: "advisor@taxpulse.test",
    priority: "High",
    stage: "Review",
  },
  {
    clientName: "Beacon Family Office",
    dueDate: "2026-07-31",
    id: "cycle_002",
    isOverdue: true,
    owner: "advisor@taxpulse.test",
    priority: "Medium",
    stage: "Modeling",
  },
  {
    clientName: "Crestview Holdings",
    dueDate: "2026-10-15",
    id: "cycle_003",
    isOverdue: false,
    owner: "advisor@taxpulse.test",
    priority: "Medium",
    stage: "Client Approval",
  },
  {
    clientName: "Dover Trust",
    dueDate: "2026-11-15",
    id: "cycle_004",
    isOverdue: false,
    owner: "advisor@taxpulse.test",
    priority: "Low",
    stage: "Data Aggregation",
  },
  {
    clientName: "Evergreen Capital",
    dueDate: "2026-12-15",
    id: "cycle_005",
    isOverdue: false,
    owner: "advisor@taxpulse.test",
    priority: "High",
    stage: "Executed",
  },
  {
    clientName: "Foxtrot Advisors",
    dueDate: "2027-01-15",
    id: "cycle_007",
    isOverdue: false,
    owner: "advisor@taxpulse.test",
    priority: "Medium",
    stage: "Review",
  },
  {
    clientName: "Granite Partners",
    dueDate: "2027-02-15",
    id: "cycle_008",
    isOverdue: false,
    owner: "advisor@taxpulse.test",
    priority: "Low",
    stage: "Modeling",
  },
  {
    clientName: "Harbor Tax Group",
    dueDate: "2027-03-15",
    id: "cycle_009",
    isOverdue: false,
    owner: "advisor@taxpulse.test",
    priority: "High",
    stage: "Intake",
  },
  {
    clientName: "Ironwood Office",
    dueDate: "2027-04-15",
    id: "cycle_010",
    isOverdue: false,
    owner: "advisor@taxpulse.test",
    priority: "Medium",
    stage: "Review",
  },
  {
    clientName: "Juniper Holdings",
    dueDate: "2027-05-15",
    id: "cycle_011",
    isOverdue: false,
    owner: "advisor@taxpulse.test",
    priority: "Low",
    stage: "Archived",
  },
];

function mockQueue(data: PlanCycleQueueRow[] = rows): void {
  vi.mocked(usePlanCycleQueue).mockReturnValue({
    data,
    error: null,
    isError: false,
    isPending: false,
    refetch: vi.fn(),
  } as ReturnType<typeof usePlanCycleQueue>);
}

describe("ScenarioResultsTable", () => {
  beforeEach(() => {
    vi.mocked(usePlanCycleQueue).mockReset();
    mockQueue();
  });

  it("renders D3 query data in a semantic table with scoped sortable headers", () => {
    render(<ScenarioResultsTable auth={auth} />);

    const table = screen.getByRole("table", { name: "Scenario Results Table" });
    expect(table.tagName).toBe("TABLE");
    const header = screen.getByRole("columnheader", { name: "Client" });
    expect(header).toHaveAttribute("scope", "col");
    expect(header).toHaveAttribute("aria-sort", "none");
    expect(screen.getByText("Zeta Family Office")).toBeInTheDocument();
    expect(usePlanCycleQueue).toHaveBeenCalledWith(auth);
  });

  it("sorts by a clicked header and exposes aria-sort", async () => {
    const user = userEvent.setup();
    render(<ScenarioResultsTable auth={auth} />);

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Client" }));
    });

    const clientHeader = screen.getByRole("columnheader", { name: "Client" });
    expect(clientHeader).toHaveAttribute("aria-sort", "ascending");
    const bodyRows = screen.getAllByRole("row").slice(1);
    expect(within(bodyRows[0]).getByText("Acme Wealth")).toBeInTheDocument();
  });

  it("filters client rows with the headless filtered row model", async () => {
    const user = userEvent.setup();
    render(<ScenarioResultsTable auth={auth} />);

    await act(async () => {
      await user.type(screen.getByLabelText("Filter by client"), "Beacon");
    });

    expect(screen.getByText("Beacon Family Office")).toBeInTheDocument();
    expect(screen.queryByText("Acme Wealth")).not.toBeInTheDocument();
    expect(screen.queryByText("Zeta Family Office")).not.toBeInTheDocument();
  });

  it("paginates rows with the headless pagination row model", async () => {
    const user = userEvent.setup();
    render(<ScenarioResultsTable auth={auth} />);

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.queryByText("Juniper Holdings")).not.toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Next" }));
    });

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Juniper Holdings")).toBeInTheDocument();
  });

  it("exposes keyboard-reachable row actions", async () => {
    const user = userEvent.setup();
    const onOpenRow = vi.fn();
    const onEditRow = vi.fn();
    const onRemoveRow = vi.fn();
    render(
      <ScenarioResultsTable
        auth={auth}
        onEditRow={onEditRow}
        onOpenRow={onOpenRow}
        onRemoveRow={onRemoveRow}
      />
    );

    await user.tab();
    expect(screen.getByLabelText("Filter by client")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Case ID" })).toHaveFocus();

    await user.click(screen.getAllByRole("button", { name: "Open" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Edit" })[0]);
    await user.click(screen.getAllByRole("button", { name: "Remove" })[0]);

    expect(onOpenRow).toHaveBeenCalledWith("cycle_006");
    expect(onEditRow).toHaveBeenCalledWith("cycle_006");
    expect(onRemoveRow).toHaveBeenCalledWith("cycle_006");
  });
});
