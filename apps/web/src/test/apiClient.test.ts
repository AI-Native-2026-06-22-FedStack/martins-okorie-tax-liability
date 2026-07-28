import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiAuthAdapter, apiRequest, resetApiClientRefreshForTest } from "../api/apiClient";
import { ApiError } from "../api/apiError";

type TestResponse = {
  ok: true;
};

function jsonResponse(body: unknown, init: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/problem+json",
      ...init.headers,
    },
  });
}

function successResponse(body: TestResponse = { ok: true }): Response {
  return jsonResponse(body, { status: 200, statusText: "OK" });
}

function unauthorizedResponse(detail = "Token expired."): Response {
  return jsonResponse(
    {
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail,
    },
    { status: 401, statusText: "Unauthorized" }
  );
}

function createAuthAdapter(): ApiAuthAdapter {
  return {
    getAccessToken: vi.fn(() => "access_123"),
    refreshSession: vi.fn(async () => undefined),
    logout: vi.fn(),
  };
}

describe("apiRequest", () => {
  beforeEach(() => {
    resetApiClientRefreshForTest();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("attaches bearer token and X-Correlation-Id to every request", async () => {
    const auth = createAuthAdapter();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(successResponse());

    await apiRequest<TestResponse>("/v1/cycles/queue", { method: "GET" }, auth);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);

    expect(headers.get("Authorization")).toBe("Bearer access_123");
    expect(headers.get("X-Correlation-Id")).toMatch(/^corr_|[0-9a-f-]{36}/);
  });

  it("maps Problem+JSON into a typed ApiError", async () => {
    const auth = createAuthAdapter();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          type: "https://taxpulse.test/problem/validation",
          title: "Invalid request",
          status: 422,
          detail: "Stage is required.",
          instance: "/v1/cycles/queue",
        },
        { status: 422, statusText: "Unprocessable Entity" }
      )
    );

    await expect(apiRequest<TestResponse>("/v1/cycles/queue", { method: "GET" }, auth)).rejects.toMatchObject({
      name: "ApiError",
      status: 422,
      problem: {
        title: "Invalid request",
        detail: "Stage is required.",
      },
    });
  });

  it("refreshes once after a 401 and retries the original request", async () => {
    const auth = createAuthAdapter();
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(unauthorizedResponse()).mockResolvedValueOnce(successResponse());

    await expect(apiRequest<TestResponse>("/v1/cycles/queue", { method: "GET" }, auth)).resolves.toEqual({
      ok: true,
    });

    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not loop when the retry also returns 401 and logs the user out", async () => {
    const auth = createAuthAdapter();
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(unauthorizedResponse("Token expired."))
      .mockResolvedValueOnce(unauthorizedResponse("Refresh did not restore access."));

    await expect(apiRequest<TestResponse>("/v1/cycles/queue", { method: "GET" }, auth)).rejects.toBeInstanceOf(
      ApiError
    );

    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shares one in-flight refresh across concurrent 401 responses", async () => {
    const auth = createAuthAdapter();
    let resolveRefresh: (() => void) | undefined;
    vi.mocked(auth.refreshSession).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = resolve;
        })
    );

    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(unauthorizedResponse())
      .mockResolvedValueOnce(unauthorizedResponse())
      .mockResolvedValueOnce(successResponse())
      .mockResolvedValueOnce(successResponse());

    const firstRequest = apiRequest<TestResponse>("/v1/cycles/queue", { method: "GET" }, auth);
    const secondRequest = apiRequest<TestResponse>("/v1/cycles/queue", { method: "GET" }, auth);

    await waitFor(() => {
      expect(auth.refreshSession).toHaveBeenCalledTimes(1);
    });

    resolveRefresh?.();

    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
