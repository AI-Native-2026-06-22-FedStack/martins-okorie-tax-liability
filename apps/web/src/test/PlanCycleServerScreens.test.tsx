import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlanCycleDetailServerScreen } from "../screens/PlanCycleDetailScreen";
import { PlanCycleQueueServerScreen } from "../screens/PlanCycleQueueScreen";
import { AuthSessionReturn } from "../hooks/useAuthSession";
import { usePlanCycleDetailQuery, usePlanCycleQueue } from "../api/usePlanCycles";
import { ApiError } from "../api/apiError";

vi.mock("../api/usePlanCycles", () => ({
  usePlanCycleDetailQuery: vi.fn(),
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

const typedError = new ApiError({
  detail: "Network error reaching TaxPulse API",
  status: 503,
  title: "Service Unavailable",
  type: "about:blank",
});

describe("server-backed plan cycle screens", () => {
  beforeEach(() => {
    vi.mocked(usePlanCycleQueue).mockReset();
    vi.mocked(usePlanCycleDetailQuery).mockReset();
  });

  it("renders queue loading, empty, error, and success states from query results", () => {
    vi.mocked(usePlanCycleQueue).mockReturnValueOnce({
      data: undefined,
      error: null,
      isError: false,
      isPending: true,
      refetch: vi.fn(),
    } as ReturnType<typeof usePlanCycleQueue>);

    const { rerender } = render(<PlanCycleQueueServerScreen auth={auth} />);
    expect(screen.getByLabelText("Loading queue skeleton")).toBeInTheDocument();

    vi.mocked(usePlanCycleQueue).mockReturnValueOnce({
      data: [],
      error: null,
      isError: false,
      isPending: false,
      refetch: vi.fn(),
    } as ReturnType<typeof usePlanCycleQueue>);
    rerender(<PlanCycleQueueServerScreen auth={auth} />);
    expect(screen.getByText("Queue is Empty")).toBeInTheDocument();

    vi.mocked(usePlanCycleQueue).mockReturnValueOnce({
      data: undefined,
      error: typedError,
      isError: true,
      isPending: false,
      refetch: vi.fn(),
    } as ReturnType<typeof usePlanCycleQueue>);
    rerender(<PlanCycleQueueServerScreen auth={auth} />);
    expect(screen.getByText("Error Loading Queue")).toBeInTheDocument();
    expect(screen.getByText("Network error reaching TaxPulse API")).toBeInTheDocument();

    vi.mocked(usePlanCycleQueue).mockReturnValueOnce({
      data: [
        {
          clientName: "client_001",
          dueDate: "2026-08-31",
          id: "cycle_001",
          isOverdue: false,
          owner: "advisor@taxpulse.test",
          priority: "High",
          stage: "Review",
        },
      ],
      error: null,
      isError: false,
      isPending: false,
      refetch: vi.fn(),
    } as ReturnType<typeof usePlanCycleQueue>);
    rerender(<PlanCycleQueueServerScreen auth={auth} />);
    expect(screen.getByText("client_001")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Plan Cycle Queue Table" })).toBeInTheDocument();
  });

  it("renders detail loading, empty, error, and success states from query results", () => {
    vi.mocked(usePlanCycleDetailQuery).mockReturnValueOnce({
      data: undefined,
      error: null,
      isError: false,
      isPending: true,
      refetch: vi.fn(),
    } as ReturnType<typeof usePlanCycleDetailQuery>);

    const { rerender } = render(<PlanCycleDetailServerScreen auth={auth} caseId="cycle_001" />);
    expect(screen.getByLabelText("Loading queue skeleton")).toBeInTheDocument();

    vi.mocked(usePlanCycleDetailQuery).mockReturnValueOnce({
      data: null,
      error: null,
      isError: false,
      isPending: false,
      refetch: vi.fn(),
    } as ReturnType<typeof usePlanCycleDetailQuery>);
    rerender(<PlanCycleDetailServerScreen auth={auth} caseId="cycle_001" />);
    expect(screen.getByText("Queue is Empty")).toBeInTheDocument();
    expect(screen.getByText("No plan cycle detail is available.")).toBeInTheDocument();

    vi.mocked(usePlanCycleDetailQuery).mockReturnValueOnce({
      data: undefined,
      error: typedError,
      isError: true,
      isPending: false,
      refetch: vi.fn(),
    } as ReturnType<typeof usePlanCycleDetailQuery>);
    rerender(<PlanCycleDetailServerScreen auth={auth} caseId="cycle_001" />);
    expect(screen.getByText("Error Loading Queue")).toBeInTheDocument();
    expect(screen.getByText("Network error reaching TaxPulse API")).toBeInTheDocument();

    vi.mocked(usePlanCycleDetailQuery).mockReturnValueOnce({
      data: {
        clientName: "client_001",
        dueDate: "2026-08-31",
        holdReason: null,
        id: "cycle_001",
        isOverdue: false,
        onHold: false,
        owner: "advisor@taxpulse.test",
        planningPeriod: "2026 Q3",
        priority: "Low",
        stage: "Modeling",
      },
      error: null,
      isError: false,
      isPending: false,
      refetch: vi.fn(),
    } as ReturnType<typeof usePlanCycleDetailQuery>);
    rerender(<PlanCycleDetailServerScreen auth={auth} caseId="cycle_001" />);
    expect(screen.getByRole("heading", { level: 1, name: "client_001" })).toBeInTheDocument();
    expect(screen.getByText("advisor@taxpulse.test")).toBeInTheDocument();
    expect(screen.getByText("Low")).toBeInTheDocument();
  });
});
