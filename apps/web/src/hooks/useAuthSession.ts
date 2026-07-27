// Storage Strategy: sessionStorage isolates access/refresh tokens to the browser session tab context to mitigate XSS exposure while persisting state across tab reloads.

import { useCallback, useEffect, useReducer } from "react";

export type UserRole = "Advisor" | "Firm Admin" | "Client";

export type AuthUser = {
  id: string;
  email: string;
  role: UserRole;
  tenantId: string;
  tenantName: string;
};

export type AuthStep = "credentials" | "mfa" | "authenticated";

export type LoginCredentials = {
  email: string;
  password?: string;
};

export type SessionState = {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  step: AuthStep;
  error: string | null;
  pendingEmail?: string;
};

export type AuthSessionReturn = {
  user: AuthUser | null;
  authenticated: boolean;
  step: AuthStep;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  submitMfa: (totpCode: string) => Promise<void>;
  logout: () => void;
  getAccessToken: () => string | null;
  resetPasswordMock: (email: string) => Promise<void>;
};

type SessionAction =
  | { type: "MFA_REQUIRED"; email: string }
  | {
      type: "LOGIN_SUCCESS";
      user: AuthUser;
      accessToken: string;
      refreshToken: string;
    }
  | { type: "TOKEN_REFRESHED"; accessToken: string; refreshToken: string }
  | { type: "LOGOUT" }
  | { type: "SET_ERROR"; error: string };

const STORAGE_KEY = "taxpulse_session";

function loadInitialState(): SessionState {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as {
        user: AuthUser;
        accessToken: string;
        refreshToken: string;
      };
      if (parsed.user && parsed.accessToken) {
        return {
          user: parsed.user,
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken,
          step: "authenticated",
          error: null,
        };
      }
    }
  } catch {
    // Session restoration failed, fall through to default
  }
  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    step: "credentials",
    error: null,
  };
}

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "MFA_REQUIRED":
      return {
        ...state,
        step: "mfa",
        pendingEmail: action.email,
        error: null,
      };
    case "LOGIN_SUCCESS":
      return {
        user: action.user,
        accessToken: action.accessToken,
        refreshToken: action.refreshToken,
        step: "authenticated",
        error: null,
      };
    case "TOKEN_REFRESHED":
      return {
        ...state,
        accessToken: action.accessToken,
        refreshToken: action.refreshToken,
      };
    case "LOGOUT":
      return {
        user: null,
        accessToken: null,
        refreshToken: null,
        step: "credentials",
        error: null,
      };
    case "SET_ERROR":
      return {
        ...state,
        error: action.error,
      };
    default:
      return state;
  }
}

export function useAuthSession(): AuthSessionReturn {
  const [state, dispatch] = useReducer(sessionReducer, null, loadInitialState);

  // Sync session state changes to sessionStorage
  useEffect(() => {
    if (state.step === "authenticated" && state.user && state.accessToken) {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          user: state.user,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
        })
      );
    } else if (state.step === "credentials") {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [state.step, state.user, state.accessToken, state.refreshToken]);

  // Centralized Token Refresh Effect with StrictMode cleanup
  useEffect(() => {
    if (state.step !== "authenticated" || !state.refreshToken) {
      return;
    }

    // Schedule token refresh 14 minutes after issuance
    const timer = setTimeout(() => {
      const mockNewAccess = `token_acc_refreshed_${Date.now()}`;
      const mockNewRefresh = `token_ref_refreshed_${Date.now()}`;

      dispatch({
        type: "TOKEN_REFRESHED",
        accessToken: mockNewAccess,
        refreshToken: mockNewRefresh,
      });
    }, 14 * 60 * 1000);

    // CLEANUP: Tear down pending timer to prevent StrictMode double-fire memory leak
    return () => {
      clearTimeout(timer);
    };
  }, [state.step, state.refreshToken]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<void> => {
    if (!credentials.email) {
      dispatch({ type: "SET_ERROR", error: "Email is required." });
      return;
    }

    // Simulate credential verification & MFA requirement
    if (credentials.email.includes("mfa")) {
      dispatch({ type: "MFA_REQUIRED", email: credentials.email });
      return;
    }

    // Mock direct login success
    const mockUser: AuthUser = {
      id: "usr_advisor_01",
      email: credentials.email,
      role: credentials.email.includes("admin") ? "Firm Admin" : "Advisor",
      tenantId: "tenant_acme_01",
      tenantName: "Acme Wealth Management",
    };

    dispatch({
      type: "LOGIN_SUCCESS",
      user: mockUser,
      accessToken: `token_acc_${Date.now()}`,
      refreshToken: `token_ref_${Date.now()}`,
    });
  }, []);

  const submitMfa = useCallback(
    async (totpCode: string): Promise<void> => {
      if (!totpCode || totpCode.trim().length !== 6) {
        dispatch({
          type: "SET_ERROR",
          error: "Please enter a valid 6-digit TOTP verification code.",
        });
        return;
      }

      const mockUser: AuthUser = {
        id: "usr_advisor_mfa",
        email: state.pendingEmail || "mfa.user@taxpulse.com",
        role: "Advisor",
        tenantId: "tenant_acme_01",
        tenantName: "Acme Wealth Management",
      };

      dispatch({
        type: "LOGIN_SUCCESS",
        user: mockUser,
        accessToken: `token_acc_mfa_${Date.now()}`,
        refreshToken: `token_ref_mfa_${Date.now()}`,
      });
    },
    [state.pendingEmail]
  );

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    dispatch({ type: "LOGOUT" });
  }, []);

  const getAccessToken = useCallback((): string | null => {
    return state.accessToken;
  }, [state.accessToken]);

  const resetPasswordMock = useCallback(async (email: string): Promise<void> => {
    if (!email) {
      dispatch({ type: "SET_ERROR", error: "Please provide your email address." });
      return;
    }
    // UI-only mock password reset (no live endpoint call)
    dispatch({ type: "SET_ERROR", error: "" });
  }, []);

  return {
    user: state.user,
    authenticated: state.step === "authenticated",
    step: state.step,
    error: state.error,
    login,
    submitMfa,
    logout,
    getAccessToken,
    resetPasswordMock,
  };
}
