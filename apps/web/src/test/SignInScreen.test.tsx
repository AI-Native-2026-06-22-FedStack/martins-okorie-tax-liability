import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthSessionReturn } from "../hooks/useAuthSession";
import { SignInScreen } from "../screens/SignInScreen";

function createMockAuth(overrides?: Partial<AuthSessionReturn>): AuthSessionReturn {
  return {
    user: null,
    authenticated: false,
    step: "credentials",
    error: null,
    login: vi.fn(),
    submitMfa: vi.fn(),
    logout: vi.fn(),
    getAccessToken: vi.fn(() => null),
    resetPasswordMock: vi.fn(),
    ...overrides,
  };
}

describe("SignInScreen Component", () => {
  it("renders credentials sign-in form by default", () => {
    const auth = createMockAuth();
    render(<SignInScreen auth={auth} />);

    expect(screen.getByRole("heading", { level: 1, name: "TaxPulse Advisory" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("submits credentials form via userEvent", async () => {
    const auth = createMockAuth();
    const user = userEvent.setup();
    render(<SignInScreen auth={auth} />);

    await act(async () => {
      const emailInput = screen.getByLabelText("Email Address");
      await user.clear(emailInput);
      await user.type(emailInput, "advisor@taxpulse.com");

      const submitButton = screen.getByRole("button", { name: "Sign In" });
      await user.click(submitButton);
    });

    expect(auth.login).toHaveBeenCalledWith({
      email: "advisor@taxpulse.com",
      password: "password123",
    });
  });

  it("renders MFA challenge code step when step='mfa'", () => {
    const auth = createMockAuth({ step: "mfa" });
    render(<SignInScreen auth={auth} />);

    expect(screen.getByText("Two-Factor Verification")).toBeInTheDocument();
    expect(screen.getByLabelText("6-Digit TOTP Code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Verify Code" })).toBeInTheDocument();
  });

  it("switches to mock password reset view when clicking Forgot password?", async () => {
    const auth = createMockAuth();
    const user = userEvent.setup();
    render(<SignInScreen auth={auth} />);

    await act(async () => {
      const forgotButton = screen.getByRole("button", { name: "Forgot password?" });
      await user.click(forgotButton);
    });

    expect(screen.getByText("Reset Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Reset Link" })).toBeInTheDocument();
  });
});
