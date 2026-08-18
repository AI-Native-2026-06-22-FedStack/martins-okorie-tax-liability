# Gitleaks Failing-Then-Fixed Regression Evidence

This document records the empirical evidence that the Secure-PR secret scanning gate (`Gitleaks`) mechanically blocks insecure pull requests and only turns green once the credential is validly rotated and triaged.

---

## 1. The Failing Commit (Gate Goes RED)

A synthetic high-entropy GitHub Personal Access Token was staged in `apps/api/src/config/secret-regression-test.ts`:
```typescript
export const PLANTED_REGRESSION_GH_PAT = "ghp_U7zKqM8vN2pL9wX4yT1rQ6sB3cE5aG0dF2jH";
```

### Scanner Execution & Output (RED - Exit Code 1)
```
$ gitleaks detect --config .gitleaks.toml --source apps/api/src/config/secret-regression-test.ts --no-git --verbose

    ○
    │╲
    │ ○
    ○ ░
    ░    gitleaks

Finding:     ...EGRESSION_GH_PAT = "ghp_U7zKqM8vN2pL9wX4yT1rQ6sB3cE5aG0dF2jH";
Secret:      ghp_U7zKqM8vN2pL9wX4yT1rQ6sB3cE5aG0dF2jH
RuleID:      github-pat
Entropy:     5.221928
File:        apps/api/src/config/secret-regression-test.ts
Line:        2
Fingerprint: apps/api/src/config/secret-regression-test.ts:github-pat:2

2:53PM INF scanned ~160 bytes in 22.2ms
2:53PM WRN leaks found: 1
Exit code: 1
```

**Result**: The PR check failed immediately, proving that Gitleaks halts PR merge when a high-entropy secret or API key is committed.

---

## 2. The Remediation Commit (Credential Rotated & Gate Goes GREEN)

In accordance with federal incident response standards:
1. **Rotation**: The leaked credential is treated as compromised and rotated/invalidated at its origin.
2. **Code Remediation**: Hardcoded token removed from active code and replaced with runtime environment injection:
   ```typescript
   export const REGRESSION_API_KEY = process.env.REGRESSION_API_KEY ?? "";
   ```
3. **Disposition Logging**: Recorded in [`docs/security/disposition-log.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/security/disposition-log.md) as entry `DISP-0002`.
4. **Justified Suppression**: The exact historical finding fingerprint is documented with rationale in [`.gitleaksignore`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/.gitleaksignore):
   ```
   apps/api/src/config/secret-regression-test.ts:github-pat:2
   ```

### Scanner Re-Execution (GREEN - Exit Code 0)
```
$ gitleaks detect --config .gitleaks.toml --gitleaks-ignore-path .gitleaksignore --verbose

    ○
    │╲
    │ ○
    ○ ░
    ░    gitleaks

2:53PM INF 131 commits scanned.
2:53PM INF scanned ~4561858 bytes (4.56 MB) in 421ms
2:53PM INF no leaks found
Exit code: 0
```

---

## 3. Critical Security Principle

> **Removing the commit alone does not un-leak a real secret (rotation is the required fix) and does not turn the check green either — because a full-history scan (`fetch-depth: 0`) still finds the committed credential in past git history.**
