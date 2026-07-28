import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/apiError";
import { useCreatePlanCycle } from "../api/usePlanCycles";
import { AuthSessionReturn } from "../hooks/useAuthSession";
import { ScenarioPlannerForm } from "../screens/ScenarioPlannerForm";

vi.mock("../api/usePlanCycles", () => ({
  useCreatePlanCycle: vi.fn(),
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

function mockCreatePlanCycle(overrides?: Partial<ReturnType<typeof useCreatePlanCycle>>): void {
  vi.mocked(useCreatePlanCycle).mockReturnValue({
    error: null,
    isError: false,
    isPending: false,
    mutateAsync: vi.fn().mockResolvedValue({ id: "cycle_001" }),
    ...overrides,
  } as ReturnType<typeof useCreatePlanCycle>);
}

describe("ScenarioPlannerForm", () => {
  beforeEach(() => {
    vi.mocked(useCreatePlanCycle).mockReset();
    mockCreatePlanCycle();
  });

  it("renders real labels for every input", () => {
    render(<ScenarioPlannerForm auth={auth} />);

    expect(screen.getByLabelText("Client Identifier")).toBeInTheDocument();
    expect(screen.getByLabelText("Planning Period")).toBeInTheDocument();
    expect(screen.getByLabelText("Owner")).toBeInTheDocument();
    expect(screen.getByLabelText("Priority")).toBeInTheDocument();
    expect(screen.getByLabelText("Due Date")).toBeInTheDocument();
    expect(screen.getByLabelText("On Hold")).toBeInTheDocument();
    expect(screen.getByLabelText("Hold Reason")).toBeInTheDocument();
  });

  it("renders shared-schema field errors and associates them to inputs", async () => {
    const user = userEvent.setup();
    render(<ScenarioPlannerForm auth={auth} />);

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Create Plan Cycle" }));
    });

    expect(await screen.findByText("Client identifier is required.")).toBeInTheDocument();
    expect(screen.getByText("Planning period is required.")).toBeInTheDocument();
    expect(screen.getByText("Due date must use YYYY-MM-DD format.")).toBeInTheDocument();

    expect(screen.getByLabelText("Client Identifier")).toHaveAttribute(
      "aria-describedby",
      "scenario-client_id-error"
    );
    expect(screen.getByLabelText("Planning Period")).toHaveAttribute(
      "aria-describedby",
      "scenario-planning_period-error"
    );
    expect(screen.getByLabelText("Due Date")).toHaveAttribute(
      "aria-describedby",
      "scenario-due_date-error"
    );
  });

  it("submits valid values through the create mutation", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue({ id: "cycle_001" });
    mockCreatePlanCycle({ mutateAsync } as Partial<ReturnType<typeof useCreatePlanCycle>>);
    render(<ScenarioPlannerForm auth={auth} onCreated={onCreated} />);

    await user.type(screen.getByLabelText("Client Identifier"), "client_001");
    await user.type(screen.getByLabelText("Planning Period"), "2026 Q3");
    await user.clear(screen.getByLabelText("Owner"));
    await user.type(screen.getByLabelText("Owner"), "advisor@taxpulse.test");
    await user.selectOptions(screen.getByLabelText("Priority"), "High");
    await user.type(screen.getByLabelText("Due Date"), "2026-08-31");

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Create Plan Cycle" }));
    });

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        client_id: "client_001",
        due_date: "2026-08-31",
        hold_reason: null,
        on_hold: false,
        owner: "advisor@taxpulse.test",
        planning_period: "2026 Q3",
        priority: "High",
      });
    });
    expect(onCreated).toHaveBeenCalledWith("cycle_001");
  });

  it("is keyboard operable through fields and submit", async () => {
    const user = userEvent.setup();
    render(<ScenarioPlannerForm auth={auth} />);

    await user.tab();
    expect(screen.getByLabelText("Client Identifier")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("Planning Period")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("Owner")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("Priority")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("Due Date")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("On Hold")).toHaveFocus();
    await user.tab();
    expect(screen.getByLabelText("Hold Reason")).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Create Plan Cycle" })).toHaveFocus();
  });

  it("renders typed mutation errors", () => {
    mockCreatePlanCycle({
      error: new ApiError({
        detail: "Network error reaching TaxPulse API",
        status: 503,
        title: "Service Unavailable",
        type: "about:blank",
      }),
      isError: true,
    } as Partial<ReturnType<typeof useCreatePlanCycle>>);

    render(<ScenarioPlannerForm auth={auth} />);

    expect(screen.getByText("Error Loading Queue")).toBeInTheDocument();
    expect(screen.getByText("Network error reaching TaxPulse API")).toBeInTheDocument();
  });
});
