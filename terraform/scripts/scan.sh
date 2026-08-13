#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scan.sh — Day-1 IaC scanning gate: Checkov + Trivy
#
# Runs both scanners against the infra/terraform directory and emits SARIF to
# artifacts/security/ for audit evidence (RA-5, SI-2). Exits non-zero if
# either scanner finds a policy violation (the gate).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TF_DIR="${REPO_ROOT}/infra/terraform"

if [ ! -d "${TF_DIR}" ]; then
  TF_DIR="${REPO_ROOT}/terraform"
fi

EVIDENCE_DIR="${REPO_ROOT}/artifacts/security"

mkdir -p "${EVIDENCE_DIR}"

EXIT_CODE=0

# ── Checkov ─────────────────────────────────────────────────────────────────
echo "▸ Running Checkov..."
if checkov \
  -d "${TF_DIR}" \
  --framework terraform \
  --output cli \
  --output sarif \
  --output-file-path "${EVIDENCE_DIR}"; then
  echo "✔ Checkov passed."
else
  echo "✘ Checkov found policy violations."
  EXIT_CODE=1
fi

echo ""

# ── Trivy ───────────────────────────────────────────────────────────────────
echo "▸ Running Trivy config scan..."
if trivy config \
  "${TF_DIR}" \
  --format sarif \
  --output "${EVIDENCE_DIR}/trivy-results.sarif"; then
  echo "✔ Trivy passed."
else
  echo "✘ Trivy found misconfigurations."
  EXIT_CODE=1
fi

echo ""

# Also run Trivy with table output for human-readable summary
echo "▸ Trivy summary (table):"
trivy config "${TF_DIR}" --severity HIGH,CRITICAL || true

echo ""
echo "▸ SARIF evidence written to: ${EVIDENCE_DIR}/"
ls -la "${EVIDENCE_DIR}/"

exit ${EXIT_CODE}
