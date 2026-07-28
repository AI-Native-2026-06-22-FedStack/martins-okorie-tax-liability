import { QueryClient } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import {
  createMemoryRouter,
  MemoryRouter,
  Navigate,
  Route,
  RouterProvider,
  Routes,
  useNavigate,
  useParams,
} from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlanCycleDetailQuery, usePlanCycleQueue } from "../api/usePlanCycles";
import { AuthSessionReturn } from "../hooks/useAuthSession";
import { RequireAuth } from "../routes/RequireAuth";
import { WorkspaceLayout, WorkspaceRouteError } from "../routes/router";
import { PlanCycleDetailServerContent } from "../screens/PlanCycleDetailScreen";
import { PlanCycleQueueServerContent } from "../screens/PlanCycleQueueScreen";

vi.mock("../api/usePlanCycles", () => ({
  usePlanCycleDetailQuery: vi.fn(),
  usePlanCycleQueue: vi.fn(),
}));

function makeAuth(overrides?: Partial<AuthSessionReturn>): AuthSessionReturn {
  return {
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
    ...overrides,
  };
}

function renderRouter(
  auth: AuthSessionReturn,
  queryClient: QueryClient,
  initialEntries: string[] = ["/cycles"]
) {
  function QueueRoute() {
    const navigate = useNavigate();
    return (
      <PlanCycleQueueServerContent
        auth={auth}
        onSelectCycle={(cycleId) => navigate(`/cycles/${cycleId}`)}
      />
    );
  }

  function DetailRoute() {
    const navigate = useNavigate();
    const { caseId } = useParams();
    return (
      <PlanCycleDetailServerContent
        auth={auth}
        caseId={caseId ?? null}
        onBack={() => navigate("/cycles")}
      />
    );
  }

  render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route
          element={auth.authenticated ? <Navigate to="/cycles" replace /> : <div>Login Screen</div>}
          path="/login"
        />
        <Route element={<RequireAuth auth={auth} />}>
          <Route element={<WorkspaceLayout auth={auth} queryClient={queryClient} />}>
            <Route element={<div>Dashboard Content</div>} path="/dashboard" />
            <Route element={<QueueRoute />} path="/cycles" />
            <Route element={<DetailRoute />} path="/cycles/:caseId" />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

function renderErrorRouter(auth: AuthSessionReturn, queryClient: QueryClient) {
  function ThrowingRoute(): React.ReactElement {
    throw new Error("Exploded route");
  }

  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth auth={auth} />,
        children: [
          {
            element: <WorkspaceLayout auth={auth} queryClient={queryClient} />,
            errorElement: <WorkspaceRouteError auth={auth} queryClient={queryClient} />,
            children: [{ element: <ThrowingRoute />, path: "/explode" }],
          },
        ],
      },
    ],
    { initialEntries: ["/explode"] }
  );

  render(<RouterProvider router={router} />);
}

describe("workspace router", () => {
  beforeEach(() => {
    vi.mocked(usePlanCycleQueue).mockReset();
    vi.mocked(usePlanCycleDetailQuery).mockReset();
  });

  it("redirects unauthenticated workspace access to login", async () => {
    const auth = makeAuth({ authenticated: false, step: "credentials", user: null });
    renderRouter(auth, new QueryClient());

    expect(await screen.findByText("Login Screen")).toBeInTheDocument();
  });

  it("renders the queue inside the shared shell for authenticated users", () => {
    vi.mocked(usePlanCycleQueue).mockReturnValue({
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

    renderRouter(makeAuth(), new QueryClient());

    expect(screen.getByRole("heading", { level: 1, name: "Plan Cycle Queue" })).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("client_001")).toBeInTheDocument();
  });

  it("navigates from queue to detail and back without replacing the shell", async () => {
    const user = userEvent.setup();
    vi.mocked(usePlanCycleQueue).mockReturnValue({
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
    vi.mocked(usePlanCycleDetailQuery).mockReturnValue({
      data: {
        clientName: "client_001",
        dueDate: "2026-08-31",
        holdReason: null,
        id: "cycle_001",
        isOverdue: false,
        onHold: false,
        owner: "advisor@taxpulse.test",
        planningPeriod: "2026 Q3",
        priority: "High",
        stage: "Review",
      },
      error: null,
      isError: false,
      isPending: false,
      refetch: vi.fn(),
    } as ReturnType<typeof usePlanCycleDetailQuery>);

    renderRouter(makeAuth(), new QueryClient());

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "cycle_001" }));
    });
    expect(await screen.findByRole("heading", { level: 1, name: "Case Detail: cycle_001" })).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("advisor@taxpulse.test")).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Back to Queue" }));
    });
    expect(screen.getByRole("heading", { level: 1, name: "Plan Cycle Queue" })).toBeInTheDocument();
    expect(screen.getByText("client_001")).toBeInTheDocument();
  });

  it("renders route errors inside the shell", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderErrorRouter(makeAuth(), new QueryClient());

    expect(await screen.findByRole("heading", { level: 1, name: "Workspace Error" })).toBeInTheDocument();
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(screen.getByText("Exploded route")).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("clears query cache and logs out from the shared shell", async () => {
    const user = userEvent.setup();
    const auth = makeAuth();
    const queryClient = new QueryClient();
    const clearSpy = vi.spyOn(queryClient, "clear");
    vi.mocked(usePlanCycleQueue).mockReturnValue({
      data: [],
      error: null,
      isError: false,
      isPending: false,
      refetch: vi.fn(),
    } as ReturnType<typeof usePlanCycleQueue>);

    renderRouter(auth, queryClient);

    await user.click(screen.getByRole("button", { name: "Sign Out" }));

    await waitFor(() => expect(clearSpy).toHaveBeenCalledTimes(1));
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });
});
