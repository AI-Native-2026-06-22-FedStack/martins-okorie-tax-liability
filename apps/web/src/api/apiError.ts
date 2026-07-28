export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
};

export class ApiError extends Error {
  readonly problem: ProblemDetails;
  readonly status: number;

  constructor(problem: ProblemDetails) {
    super(problem.detail || problem.title);
    this.name = "ApiError";
    this.problem = problem;
    this.status = problem.status;
  }
}

export function isProblemDetails(value: unknown): value is ProblemDetails {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  const hasRequiredFields =
    typeof candidate.type === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.status === "number" &&
    typeof candidate.detail === "string";

  const hasValidInstance =
    candidate.instance === undefined || typeof candidate.instance === "string";

  return hasRequiredFields && hasValidInstance;
}

export function fallbackProblem(status: number, statusText: string): ProblemDetails {
  return {
    type: "about:blank",
    title: statusText || "API request failed",
    status,
    detail: statusText || "The TaxPulse API request failed.",
  };
}
