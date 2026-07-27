import React, { useState } from "react";
import { AuthSessionReturn } from "../hooks/useAuthSession";
import styles from "./SignInScreen.module.css";

export type SignInScreenProps = {
  auth: AuthSessionReturn;
};

export function SignInScreen({ auth }: SignInScreenProps): React.ReactElement {
  const { step, error, login, submitMfa, resetPasswordMock } = auth;

  const [email, setEmail] = useState("advisor@taxpulse.com");
  const [password, setPassword] = useState("password123");
  const [totpCode, setTotpCode] = useState("");
  const [isResetView, setIsResetView] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage("");
    await login({ email, password });
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMfa(totpCode);
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await resetPasswordMock(email);
    setResetMessage(`Password reset link sent to ${email} (Mock).`);
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <h1 className={styles.brandTitle}>TaxPulse Advisory</h1>
          <p className={styles.brandSubtitle}>
            {step === "mfa"
              ? "Two-Factor Verification"
              : isResetView
              ? "Reset Password"
              : "Sign in to your account"}
          </p>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}
        {resetMessage && <div className={styles.successBanner}>{resetMessage}</div>}

        {/* Credentials Step */}
        {step === "credentials" && !isResetView && (
          <form className={styles.form} onSubmit={handleCredentialsSubmit}>
            <div className={styles.fieldGroup}>
              <label htmlFor="email" className={styles.label}>
                Email Address
              </label>
              <input
                id="email"
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="password" className={styles.label}>
                Password
              </label>
              <input
                id="password"
                type="password"
                className={styles.input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="button"
              className={styles.linkButton}
              onClick={() => setIsResetView(true)}
            >
              Forgot password?
            </button>

            <button type="submit" className={styles.submitButton}>
              Sign In
            </button>
          </form>
        )}

        {/* MFA Challenge Step */}
        {step === "mfa" && (
          <form className={styles.form} onSubmit={handleMfaSubmit}>
            <div className={styles.fieldGroup}>
              <label htmlFor="totp" className={styles.label}>
                6-Digit TOTP Code
              </label>
              <input
                id="totp"
                type="text"
                maxLength={6}
                placeholder="123456"
                className={styles.input}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                required
              />
            </div>

            <button type="submit" className={styles.submitButton}>
              Verify Code
            </button>
          </form>
        )}

        {/* Mocked Password Reset View */}
        {isResetView && (
          <form className={styles.form} onSubmit={handleResetSubmit}>
            <div className={styles.fieldGroup}>
              <label htmlFor="reset-email" className={styles.label}>
                Account Email
              </label>
              <input
                id="reset-email"
                type="email"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <button type="submit" className={styles.submitButton}>
              Send Reset Link
            </button>

            <button
              type="button"
              className={styles.linkButton}
              style={{ alignSelf: "center", marginTop: "8px" }}
              onClick={() => setIsResetView(false)}
            >
              Back to Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
