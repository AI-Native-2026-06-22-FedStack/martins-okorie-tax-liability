import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { ApiAuthAdapter, apiRequest } from "./apiClient";
import { ApiError } from "./apiError";
import { AuthSessionReturn, UserRole } from "../hooks/useAuthSession";
import {
  PlanCycleQueueRow,
  PlanCycleStage,
} from "../components/PlanCycleQueueTable";

export type PlanCyclePriority = PlanCycleQueueRow["priority"];

export type PlanCycleQueueScope = {
  tenantId: string;
  role: UserRole;
  owner?: string;
  stages: PlanCycleStage[];
  limit: number;
};

export type PlanCycleDetailScope = {
  tenantId: string;
  role: UserRole;
  cycleId: string;
};

export type PlanCycleDetailRecord = {
  id: string;
  clientName: string;
  stage: PlanCycleStage;
  owner: string;
  priority: PlanCyclePriority;
  dueDate: string;
  isOverdue: boolean;
  planningPeriod: string;
  onHold: boolean;
  holdReason: string | null;
};

export type TransitionPlanCycleInput = {
  cycleId: string;
  toStage: PlanCycleStage;
  reason: string;
};

type QueueResponse = {
  data: ApiPlanCycleQueueRow[];
};

type ApiPlanCycleQueueRow = {
  client_id: string;
  due_date: string;
  hold_reason?: string | null;
  id: string;
  on_hold?: boolean;
  overdue?: boolean;
  owner: string;
  planning_period: string;
  priority: string;
  stage: string;
  tenant_id: string;
};

type ApiPlanCycleDetail = ApiPlanCycleQueueRow & {
  created_at?: string | Date;
  metadata?: Record<string, unknown>;
  updated_at?: string | Date;
};

type TransitionResponse = {
  status: string;
  message: string;
};

const ACTIVE_QUEUE_STAGES: PlanCycleStage[] = [
  "Intake",
  "Data Aggregation",
  "Modeling",
  "Review",
  "Client Approval",
  "Executed",
];

const validStages = new Set<PlanCycleStage>([
  "Intake",
  "Data Aggregation",
  "Modeling",
  "Review",
  "Client Approval",
  "Executed",
  "Archived",
]);

function isPlanCycleStage(stage: string): stage is PlanCycleStage {
  return validStages.has(stage as PlanCycleStage);
}

function mapStage(stage: string): PlanCycleStage {
  return isPlanCycleStage(stage) ? stage : "Intake";
}

function mapPriority(priority: string): PlanCyclePriority {
  if (priority === "High" || priority === "Medium" || priority === "Low") {
    return priority;
  }

  return "Medium";
}

function buildApiAuth(auth: AuthSessionReturn): ApiAuthAdapter {
  return {
    getAccessToken: auth.getAccessToken,
    refreshSession: auth.refreshSession,
    logout: auth.logout,
  };
}

function apiHeaders(tenantId: string): HeadersInit {
  return {
    "x-tenant-id": tenantId,
  };
}

function makeQueueScope(auth: AuthSessionReturn): PlanCycleQueueScope | null {
  if (!auth.user) {
    return null;
  }

  return {
    tenantId: auth.user.tenantId,
    role: auth.user.role,
    owner: auth.user.role === "Advisor" ? auth.user.email : undefined,
    stages: ACTIVE_QUEUE_STAGES,
    limit: 50,
  };
}

export function mapApiQueueRow(row: ApiPlanCycleQueueRow): PlanCycleQueueRow {
  return {
    id: row.id,
    clientName: row.client_id,
    stage: mapStage(row.stage),
    owner: row.owner,
    priority: mapPriority(row.priority),
    dueDate: row.due_date,
    isOverdue: Boolean(row.overdue),
  };
}

export function mapApiDetail(row: ApiPlanCycleDetail): PlanCycleDetailRecord {
  return {
    id: row.id,
    clientName: row.client_id,
    stage: mapStage(row.stage),
    owner: row.owner,
    priority: mapPriority(row.priority),
    dueDate: row.due_date,
    isOverdue: Boolean(row.overdue),
    planningPeriod: row.planning_period,
    onHold: Boolean(row.on_hold),
    holdReason: row.hold_reason ?? null,
  };
}

export const planCycleKeys = {
  queue: (scope: PlanCycleQueueScope) =>
    [
      "plan-cycles",
      "queue",
      {
        limit: scope.limit,
        owner: scope.owner ?? "all",
        role: scope.role,
        stages: scope.stages,
        tenantId: scope.tenantId,
      },
    ] as const,
  detail: (scope: PlanCycleDetailScope) =>
    [
      "plan-cycles",
      "detail",
      {
        cycleId: scope.cycleId,
        role: scope.role,
        tenantId: scope.tenantId,
      },
    ] as const,
};

export async function fetchPlanCycleQueue(
  auth: AuthSessionReturn,
  scope: PlanCycleQueueScope
): Promise<PlanCycleQueueRow[]> {
  const apiAuth = buildApiAuth(auth);
  const rowsByStage = await Promise.all(
    scope.stages.map((stage) => {
      const params = new URLSearchParams({
        limit: String(scope.limit),
        stage,
      });
      if (scope.owner) {
        params.set("owner", scope.owner);
      }

      return apiRequest<QueueResponse>(
        `/v1/cycles/queue?${params.toString()}`,
        {
          headers: apiHeaders(scope.tenantId),
          method: "GET",
        },
        apiAuth
      );
    })
  );

  const rows = rowsByStage.flatMap((response) => response.data.map(mapApiQueueRow));
  return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
}

export async function fetchPlanCycleDetail(
  auth: AuthSessionReturn,
  scope: PlanCycleDetailScope
): Promise<PlanCycleDetailRecord> {
  const detail = await apiRequest<ApiPlanCycleDetail>(
    `/v1/cycles/${scope.cycleId}`,
    {
      headers: apiHeaders(scope.tenantId),
      method: "GET",
    },
    buildApiAuth(auth)
  );

  return mapApiDetail(detail);
}

function updateOptimisticQueueRows(
  rows: PlanCycleQueueRow[] | undefined,
  input: TransitionPlanCycleInput
): PlanCycleQueueRow[] | undefined {
  return rows?.map((row) =>
    row.id === input.cycleId
      ? {
          ...row,
          stage: input.toStage,
        }
      : row
  );
}

function updateOptimisticDetail(
  detail: PlanCycleDetailRecord | undefined,
  input: TransitionPlanCycleInput
): PlanCycleDetailRecord | undefined {
  if (!detail || detail.id !== input.cycleId) {
    return detail;
  }

  return {
    ...detail,
    stage: input.toStage,
  };
}

export function usePlanCycleQueue(auth: AuthSessionReturn): UseQueryResult<PlanCycleQueueRow[], ApiError> {
  const scope = makeQueueScope(auth);

  return useQuery<PlanCycleQueueRow[], ApiError>({
    enabled: auth.authenticated && Boolean(scope),
    queryFn: () => {
      if (!scope) {
        return Promise.resolve([]);
      }
      return fetchPlanCycleQueue(auth, scope);
    },
    queryKey: scope
      ? planCycleKeys.queue(scope)
      : ["plan-cycles", "queue", { role: "anonymous", tenantId: "none" }],
  });
}

export function usePlanCycleDetailQuery(
  auth: AuthSessionReturn,
  cycleId: string | null
): UseQueryResult<PlanCycleDetailRecord | null, ApiError> {
  const scope =
    auth.user && cycleId
      ? {
          cycleId,
          role: auth.user.role,
          tenantId: auth.user.tenantId,
        }
      : null;

  return useQuery<PlanCycleDetailRecord | null, ApiError>({
    enabled: auth.authenticated && Boolean(scope),
    queryFn: () => {
      if (!scope) {
        return Promise.resolve(null);
      }
      return fetchPlanCycleDetail(auth, scope);
    },
    queryKey: scope
      ? planCycleKeys.detail(scope)
      : ["plan-cycles", "detail", { cycleId: "none", role: "anonymous", tenantId: "none" }],
  });
}

type TransitionMutationContext = {
  detailKey: ReturnType<typeof planCycleKeys.detail>;
  previousDetail: PlanCycleDetailRecord | undefined;
  previousQueue: PlanCycleQueueRow[] | undefined;
  queueKey: ReturnType<typeof planCycleKeys.queue>;
};

async function transitionPlanCycle(
  auth: AuthSessionReturn,
  tenantId: string,
  input: TransitionPlanCycleInput
): Promise<TransitionResponse> {
  return apiRequest<TransitionResponse>(
    `/v1/cycles/${input.cycleId}/transition`,
    {
      body: {
        reason: input.reason,
        toStage: input.toStage,
      },
      headers: apiHeaders(tenantId),
      method: "PATCH",
    },
    buildApiAuth(auth)
  );
}

export function useTransitionPlanCycle(
  auth: AuthSessionReturn,
  scope: PlanCycleQueueScope
): UseMutationResult<TransitionResponse, ApiError, TransitionPlanCycleInput, TransitionMutationContext> {
  const queryClient = useQueryClient();
  const queueKey = planCycleKeys.queue(scope);

  return useMutation<TransitionResponse, ApiError, TransitionPlanCycleInput, TransitionMutationContext>({
    mutationFn: (input) => transitionPlanCycle(auth, scope.tenantId, input),
    onMutate: async (input) => {
      const detailKey = planCycleKeys.detail({
        cycleId: input.cycleId,
        role: scope.role,
        tenantId: scope.tenantId,
      });

      await Promise.all([
        queryClient.cancelQueries({ queryKey: queueKey }),
        queryClient.cancelQueries({ queryKey: detailKey }),
      ]);

      const previousQueue = queryClient.getQueryData<PlanCycleQueueRow[]>(queueKey);
      const previousDetail = queryClient.getQueryData<PlanCycleDetailRecord>(detailKey);

      queryClient.setQueryData<PlanCycleQueueRow[]>(
        queueKey,
        (rows) => updateOptimisticQueueRows(rows, input) ?? rows
      );
      queryClient.setQueryData<PlanCycleDetailRecord>(
        detailKey,
        (detail) => updateOptimisticDetail(detail, input) ?? detail
      );

      return {
        detailKey,
        previousDetail,
        previousQueue,
        queueKey,
      };
    },
    onError: (_error, _input, context) => {
      if (!context) {
        return;
      }

      queryClient.setQueryData(context.queueKey, context.previousQueue);
      queryClient.setQueryData(context.detailKey, context.previousDetail);
    },
    onSettled: (_data, _error, _input, context) => {
      if (!context) {
        return;
      }

      void invalidatePlanCycleQueries(queryClient, context);
    },
  });
}

async function invalidatePlanCycleQueries(
  queryClient: QueryClient,
  context: Pick<TransitionMutationContext, "detailKey" | "queueKey">
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: context.queueKey }),
    queryClient.invalidateQueries({ queryKey: context.detailKey }),
  ]);
}
