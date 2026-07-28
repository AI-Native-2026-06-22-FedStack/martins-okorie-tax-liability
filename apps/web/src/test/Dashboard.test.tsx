import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlanCycleQueue } from "../api/usePlanCycles";
import { ApiError } from "../api/apiError";
import { PlanCycleQueueRow } from "../components/PlanCycleQueueTable";
import { AuthSessionReturn } from "../hooks/useAuthSession";
import { Dashboard, buildDashboardModel } from "../screens/Dashboard";

vi.mock("../api/usePlanCycles", () => ({
  usePlanCycleQueue: vi.fn(),
}));

vi.mock("react-chartjs-2", () => ({
  Bar: ({ "aria-label": ariaLabel }: { "aria-label": string }) => (
    <canvas aria-label={ariaLabel} role="img" />
  ),
  Doughnut: ({ "aria-label": ariaLabel }: { "aria-label": string }) => (
    <canvas aria-label={ariaLabel} role="img" />
  ),
  Line: ({ "aria-label": ariaLabel }: { "aria-label": string }) => (
    <canvas aria-label={ariaLabel} role="img" />
  ),
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
    clientName: "client_001",
    dueDate: "2026-01-15",
    id: "cycle_001",
    isOverdue: false,
    owner: "advisor@taxpulse.test",
    priority: "High",
    stage: "Intake",
  },
  {
    clientName: "client_002",
    dueDate: "2026-04-15",
    id: "cycle_002",
    isOverdue: true,
    owner: "advisor@taxpulse.test",
    priority: "Low",
    stage: "Review",
  },
  {
    clientName: "client_003",
    dueDate: "2027-07-15",
    id: "cycle_003",
    isOverdue: false,
    owner: "advisor@taxpulse.test",
    priority: "Medium",
    stage: "Modeling",
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

describe("Dashboard", () => {
  beforeEach(() => {
    vi.mocked(usePlanCycleQueue).mockReset();
    mockQueue();
  });

  it("maps real query rows into dashboard model groups", () => {
    expect(buildDashboardModel(rows)).toMatchObject({
      estimatedTaxByQuarter: [
        { label: "Q1", value: 1 },
        { label: "Q2", value: 1 },
        { label: "Q3", value: 1 },
        { label: "Q4", value: 0 },
      ],
      incomeBreakdown: [
        { label: "Intake", value: 1 },
        { label: "Data Aggregation", value: 0 },
        { label: "Modeling", value: 1 },
        { label: "Review", value: 1 },
        { label: "Client Approval", value: 0 },
        { label: "Executed", value: 0 },
        { label: "Archived", value: 0 },
      ],
      taxBreakdown: [
        { label: "High", value: 1 },
        { label: "Medium", value: 1 },
        { label: "Low", value: 0 },
        { label: "Overdue", value: 1 },
      ],
      yearOverYear: [
        { label: "2026", value: 2 },
        { label: "2027", value: 1 },
      ],
    });
  });

  it("renders KPI cards and four chart text alternatives from query data", () => {
    render(<Dashboard auth={auth} />);

    expect(usePlanCycleQueue).toHaveBeenCalledWith(auth);
    expect(screen.getByText("Q1 Quarterly Payments")).toBeInTheDocument();
    expect(screen.getByText("Q2 Quarterly Payments")).toBeInTheDocument();
    expect(screen.getByText("Q3 Quarterly Payments")).toBeInTheDocument();
    expect(screen.getByText("Q4 Quarterly Payments")).toBeInTheDocument();

    expect(screen.getByRole("img", { name: /Estimated-Tax-by-Quarter. Q1: 1/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Income Breakdown. Intake: 1/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Tax Breakdown. High: 1/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Year-over-Year. 2026: 2/i })).toBeInTheDocument();

    expect(screen.getByRole("table", { name: "Estimated-Tax-by-Quarter data table" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Income Breakdown data table" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Tax Breakdown data table" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Year-over-Year data table" })).toBeInTheDocument();
  });

  it("changes chart alternatives when query data changes", () => {
    const { rerender } = render(<Dashboard auth={auth} />);
    expect(screen.getByRole("img", { name: /Q4: 0/i })).toBeInTheDocument();

    mockQueue([
      ...rows,
      {
        clientName: "client_004",
        dueDate: "2027-12-15",
        id: "cycle_004",
        isOverdue: false,
        owner: "advisor@taxpulse.test",
        priority: "High",
        stage: "Executed",
      },
    ]);

    rerender(<Dashboard auth={auth} />);
    expect(screen.getByRole("img", { name: /Q4: 1/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /2027: 2/i })).toBeInTheDocument();
  });

  it("renders loading, empty, and typed error states", () => {
    vi.mocked(usePlanCycleQueue).mockReturnValueOnce({
      data: undefined,
      error: null,
      isError: false,
      isPending: true,
      refetch: vi.fn(),
    } as ReturnType<typeof usePlanCycleQueue>);
    const { rerender } = render(<Dashboard auth={auth} />);
    expect(screen.getByLabelText("Loading queue skeleton")).toBeInTheDocument();

    vi.mocked(usePlanCycleQueue).mockReturnValueOnce({
      data: [],
      error: null,
      isError: false,
      isPending: false,
      refetch: vi.fn(),
    } as ReturnType<typeof usePlanCycleQueue>);
    rerender(<Dashboard auth={auth} />);
    expect(screen.getByText("No dashboard data is available.")).toBeInTheDocument();

    vi.mocked(usePlanCycleQueue).mockReturnValueOnce({
      data: undefined,
      error: new ApiError({
        detail: "Dashboard query failed",
        status: 503,
        title: "Service Unavailable",
        type: "about:blank",
      }),
      isError: true,
      isPending: false,
      refetch: vi.fn(),
    } as ReturnType<typeof usePlanCycleQueue>);
    rerender(<Dashboard auth={auth} />);
    expect(screen.getByText("Dashboard query failed")).toBeInTheDocument();
  });

  it("allows keyboard access to chart alternative data tables", async () => {
    const user = userEvent.setup();
    render(<Dashboard auth={auth} />);

    await user.tab();
    expect(screen.getByRole("table", { name: "Estimated-Tax-by-Quarter data table" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("table", { name: "Income Breakdown data table" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("table", { name: "Tax Breakdown data table" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("table", { name: "Year-over-Year data table" })).toHaveFocus();
  });
});
