import { ApiError, fallbackProblem, isProblemDetails, ProblemDetails } from "./apiError";

export type ApiAuthAdapter = {
  getAccessToken: () => string | null;
  refreshSession: () => Promise<void>;
  logout: () => void;
};

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | object | null;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

let refreshInFlight: Promise<void> | null = null;

export function resetApiClientRefreshForTest(): void {
  refreshInFlight = null;
}

function createCorrelationId(): string {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `corr_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function buildHeaders(options: ApiRequestOptions, auth: ApiAuthAdapter): Headers {
  const headers = new Headers(options.headers);
  const accessToken = auth.getAccessToken();

  headers.set("X-Correlation-Id", headers.get("X-Correlation-Id") ?? createCorrelationId());

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

function buildBody(body: ApiRequestOptions["body"]): BodyInit | null | undefined {
  if (!body || body instanceof FormData || typeof body === "string") {
    return body;
  }

  return JSON.stringify(body);
}

async function parseProblem(response: Response): Promise<ProblemDetails> {
  try {
    const body: unknown = await response.json();
    if (isProblemDetails(body)) {
      return body;
    }
  } catch {
    // Fall through to a generic typed problem.
  }

  return fallbackProblem(response.status, response.statusText);
}

async function parseResponse<TResponse>(response: Response): Promise<TResponse> {
  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

async function refreshOnce(auth: ApiAuthAdapter): Promise<void> {
  if (!refreshInFlight) {
    refreshInFlight = auth.refreshSession().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
}

async function executeRequest(path: string, options: ApiRequestOptions, auth: ApiAuthAdapter): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: buildHeaders(options, auth),
    body: buildBody(options.body),
  });
}

export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions,
  auth: ApiAuthAdapter
): Promise<TResponse> {
  const firstResponse = await executeRequest(path, options, auth);

  if (firstResponse.status === 401) {
    try {
      await refreshOnce(auth);
    } catch {
      auth.logout();
      throw new ApiError(fallbackProblem(401, "Unauthorized"));
    }

    const retryResponse = await executeRequest(path, options, auth);
    if (retryResponse.status === 401) {
      auth.logout();
      throw new ApiError(await parseProblem(retryResponse));
    }

    if (!retryResponse.ok) {
      throw new ApiError(await parseProblem(retryResponse));
    }

    return parseResponse<TResponse>(retryResponse);
  }

  if (!firstResponse.ok) {
    throw new ApiError(await parseProblem(firstResponse));
  }

  return parseResponse<TResponse>(firstResponse);
}
