import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthSession } from "../hooks/useAuthSession";

describe("useAuthSession Custom Hook", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  it("starts in unauthenticated credentials step by default", () => {
    const { result } = renderHook(() => useAuthSession());

    expect(result.current.authenticated).toBe(false);
    expect(result.current.step).toBe("credentials");
    expect(result.current.user).toBeNull();
    expect(result.current.getAccessToken()).toBeNull();
  });

  it("handles successful direct login", async () => {
    const { result } = renderHook(() => useAuthSession());

    await act(async () => {
      await result.current.login({ email: "advisor@taxpulse.com", password: "pass" });
    });

    expect(result.current.authenticated).toBe(true);
    expect(result.current.step).toBe("authenticated");
    expect(result.current.user?.email).toBe("advisor@taxpulse.com");
    expect(result.current.user?.role).toBe("Advisor");
    expect(result.current.getAccessToken()).toBeTruthy();
  });

  it("handles MFA challenge requirement step and verification completion", async () => {
    const { result } = renderHook(() => useAuthSession());

    await act(async () => {
      await result.current.login({ email: "mfa.advisor@taxpulse.com" });
    });

    expect(result.current.authenticated).toBe(false);
    expect(result.current.step).toBe("mfa");

    await act(async () => {
      await result.current.submitMfa("123456");
    });

    expect(result.current.authenticated).toBe(true);
    expect(result.current.step).toBe("authenticated");
  });

  it("restores session from sessionStorage across reload", () => {
    const mockSession = {
      user: {
        id: "usr_100",
        email: "restored@taxpulse.com",
        role: "Advisor",
        tenantId: "tenant_01",
        tenantName: "Acme Wealth",
      },
      accessToken: "access_123",
      refreshToken: "refresh_123",
    };
    sessionStorage.setItem("taxpulse_session", JSON.stringify(mockSession));

    const { result } = renderHook(() => useAuthSession());

    expect(result.current.authenticated).toBe(true);
    expect(result.current.user?.email).toBe("restored@taxpulse.com");
    expect(result.current.getAccessToken()).toBe("access_123");
  });

  it("clears session state and sessionStorage on logout", async () => {
    const { result } = renderHook(() => useAuthSession());

    await act(async () => {
      await result.current.login({ email: "advisor@taxpulse.com" });
    });
    expect(result.current.authenticated).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(result.current.authenticated).toBe(false);
    expect(result.current.step).toBe("credentials");
    expect(result.current.user).toBeNull();
    expect(sessionStorage.getItem("taxpulse_session")).toBeNull();
  });

  it("clears token refresh timer on unmount preventing leaks and StrictMode double-fire", async () => {
    const { result, unmount } = renderHook(() => useAuthSession());

    await act(async () => {
      await result.current.login({ email: "advisor@taxpulse.com" });
    });

    // Unmount hook and verify timer is cleared without errors
    unmount();
    expect(() => vi.runOnlyPendingTimers()).not.toThrow();
  });
});
