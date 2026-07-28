import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../api/apiClient";
import {
  PlanCycleQueueScope,
  fetchPlanCycleDetail,
  fetchPlanCycleQueue,
  planCycleKeys,
  useCreatePlanCycle,
  usePlanCycleDetailQuery,
  usePlanCycleQueue,
  useTransitionPlanCycle,
} from "../api/usePlanCycles";
import { AuthSessionReturn } from "../hooks/useAuthSession";

vi.mock("../api/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/apiClient")>();
  return {
    ...actual,
    apiRequest: vi.fn(),
  };
});

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

const queueScope: PlanCycleQueueScope = {
  limit: 50,
  owner: "advisor@taxpulse.test",
  role: "Advisor",
  stages: ["Intake", "Review"],
  tenantId: "tenant_123",
};

function createWrapper(queryClient: QueryClient): React.FC<{ children: React.ReactNode }> {
  return function TestQueryProvider({ children }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        retry: false,
      },
    },
  });
}

describe("usePlanCycles server-state hooks", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches queue rows through apiRequest using stage-scoped backend requests", async () => {
    vi.mocked(apiRequest)
      .mockResolvedValueOnce({
        data: [
          {
            client_id: "client_001",
            due_date: "2026-08-31",
            id: "cycle_001",
            overdue: false,
            owner: "advisor@taxpulse.test",
            planning_period: "2026 Q3",
            priority: "High",
            stage: "Intake",
            tenant_id: "tenant_123",
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          {
            client_id: "client_002",
            due_date: "2026-07-31",
            id: "cycle_002",
            overdue: true,
            owner: "advisor@taxpulse.test",
            planning_period: "2026 Q2",
            priority: "Unexpected",
            stage: "Review",
            tenant_id: "tenant_123",
          },
        ],
      });

    await expect(fetchPlanCycleQueue(auth, queueScope)).resolves.toEqual([
      {
        clientName: "client_002",
        dueDate: "2026-07-31",
        id: "cycle_002",
        isOverdue: true,
        owner: "advisor@taxpulse.test",
        priority: "Medium",
        stage: "Review",
      },
      {
        clientName: "client_001",
        dueDate: "2026-08-31",
        id: "cycle_001",
        isOverdue: false,
        owner: "advisor@taxpulse.test",
        priority: "High",
        stage: "Intake",
      },
    ]);

    expect(apiRequest).toHaveBeenCalledTimes(2);
    expect(vi.mocked(apiRequest).mock.calls[0][0]).toContain("/v1/cycles/queue?");
    expect(vi.mocked(apiRequest).mock.calls[0][0]).toContain("stage=Intake");
    expect(vi.mocked(apiRequest).mock.calls[1][0]).toContain("stage=Review");
  });

  it("uses a tenant and role scoped queue query key", async () => {
    const queryClient = createQueryClient();
    vi.mocked(apiRequest).mockResolvedValue({ data: [] });

    const { result } = renderHook(() => usePlanCycleQueue(auth), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const queryHash = queryClient.getQueryCache().getAll()[0]?.queryKey;
    expect(queryHash).toEqual(
      planCycleKeys.queue({
        limit: 50,
        owner: "advisor@taxpulse.test",
        role: "Advisor",
        stages: ["Intake", "Data Aggregation", "Modeling", "Review", "Client Approval", "Executed"],
        tenantId: "tenant_123",
      })
    );
  });

  it("uses a per-cycle detail key that includes the cycle id", async () => {
    const queryClient = createQueryClient();
    vi.mocked(apiRequest).mockResolvedValue({
      client_id: "client_001",
      due_date: "2026-08-31",
      id: "cycle_001",
      on_hold: false,
      overdue: false,
      owner: "advisor@taxpulse.test",
      planning_period: "2026 Q3",
      priority: "Low",
      stage: "Modeling",
      tenant_id: "tenant_123",
    });

    const { result } = renderHook(() => usePlanCycleDetailQuery(auth, "cycle_001"), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryCache().getAll()[0]?.queryKey).toEqual(
      planCycleKeys.detail({
        cycleId: "cycle_001",
        role: "Advisor",
        tenantId: "tenant_123",
      })
    );
    await expect(
      fetchPlanCycleDetail(auth, {
        cycleId: "cycle_001",
        role: "Advisor",
        tenantId: "tenant_123",
      })
    ).resolves.toMatchObject({
      id: "cycle_001",
      stage: "Modeling",
    });
  });

  it("creates a plan cycle through apiRequest and invalidates the scoped queue key", async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.mocked(apiRequest).mockResolvedValue({ id: "cycle_001" });

    const { result } = renderHook(() => useCreatePlanCycle(auth), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        client_id: "client_001",
        due_date: "2026-08-31",
        hold_reason: null,
        on_hold: false,
        owner: "advisor@taxpulse.test",
        planning_period: "2026 Q3",
        priority: "High",
      });
    });

    expect(apiRequest).toHaveBeenCalledWith(
      "/v1/cycles",
      {
        body: {
          client_id: "client_001",
          due_date: "2026-08-31",
          hold_reason: null,
          on_hold: false,
          owner: "advisor@taxpulse.test",
          planning_period: "2026 Q3",
          priority: "High",
        },
        headers: {
          "x-tenant-id": "tenant_123",
        },
        method: "POST",
      },
      expect.objectContaining({
        getAccessToken: auth.getAccessToken,
        logout: auth.logout,
        refreshSession: auth.refreshSession,
      })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: planCycleKeys.queue({
        limit: 50,
        owner: "advisor@taxpulse.test",
        role: "Advisor",
        stages: ["Intake", "Data Aggregation", "Modeling", "Review", "Client Approval", "Executed"],
        tenantId: "tenant_123",
      }),
    });
  });

  it("optimistically updates then rolls back a failed transition", async () => {
    const queryClient = createQueryClient();
    const queueKey = planCycleKeys.queue(queueScope);
    const detailKey = planCycleKeys.detail({
      cycleId: "cycle_001",
      role: "Advisor",
      tenantId: "tenant_123",
    });

    queryClient.setQueryData(queueKey, [
      {
        clientName: "client_001",
        dueDate: "2026-08-31",
        id: "cycle_001",
        isOverdue: false,
        owner: "advisor@taxpulse.test",
        priority: "High",
        stage: "Intake",
      },
    ]);
    queryClient.setQueryData(detailKey, {
      clientName: "client_001",
      dueDate: "2026-08-31",
      holdReason: null,
      id: "cycle_001",
      isOverdue: false,
      onHold: false,
      owner: "advisor@taxpulse.test",
      planningPeriod: "2026 Q3",
      priority: "High",
      stage: "Intake",
    });

    let rejectMutation: ((error: Error) => void) | undefined;
    vi.mocked(apiRequest).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectMutation = reject;
        })
    );

    const { result } = renderHook(() => useTransitionPlanCycle(auth, queueScope), {
      wrapper: createWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        cycleId: "cycle_001",
        reason: "Advisor completed intake.",
        toStage: "Data Aggregation",
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(detailKey)).toMatchObject({ stage: "Data Aggregation" });
    });

    act(() => {
      rejectMutation?.(new Error("transition failed"));
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(detailKey)).toMatchObject({ stage: "Intake" });
      expect(queryClient.getQueryData(queueKey)).toEqual([
        expect.objectContaining({ id: "cycle_001", stage: "Intake" }),
      ]);
    });
  });

  it("invalidates the exact queue and detail keys after a transition settles", async () => {
    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.mocked(apiRequest).mockResolvedValue({
      message: "Tax Plan Cycle successfully transitioned to Modeling.",
      status: "success",
    });

    const { result } = renderHook(() => useTransitionPlanCycle(auth, queueScope), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        cycleId: "cycle_001",
        reason: "Source documents are ready.",
        toStage: "Modeling",
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: planCycleKeys.queue(queueScope),
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: planCycleKeys.detail({
        cycleId: "cycle_001",
        role: "Advisor",
        tenantId: "tenant_123",
      }),
    });
  });
});
