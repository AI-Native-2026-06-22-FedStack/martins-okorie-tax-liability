#!/usr/bin/env bash
set -euo pipefail

echo "==> Running Gitleaks pre-commit secret scan..."
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks protect --staged --config .gitleaks.toml --gitleaks-ignore-path .gitleaksignore --verbose
  echo "==> Gitleaks pre-commit check passed cleanly."
else
  echo "==> Warning: gitleaks CLI is not installed locally. Skipping pre-commit secret check."
fi
