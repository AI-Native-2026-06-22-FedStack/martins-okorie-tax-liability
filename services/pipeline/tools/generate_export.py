"""
TaxPulse Analytical Pipeline — Vendor Income Event Export Generator

Generates realistic, analytical-scale income event exports mirroring operational
tax_plan_cycle and tenant entities and Tax Engine calculation structures.

Outputs a deterministic, gzipped CSV file into data/exports/.
"""

import argparse
import csv
import gzip
import os
import random
from datetime import date, datetime, timedelta
from pathlib import Path

# Operational & synthetic tenants and cycles for cross-period analysis
SEED_TENANTS = [
    ("11111111-1111-4111-8111-111111111111", "Evergreen Advisory Local"),
    ("22222222-2222-4222-8222-222222222222", "Harbor Point Wealth Local"),
    ("33333333-3333-4333-8333-333333333333", "Beacon Peak Advisory"),
    ("44444444-4444-4444-8444-444444444444", "Meridian Family Office"),
]

SEED_CYCLES = [
    # (cycle_id, tenant_id, client_id, planning_period)
    ("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "11111111-1111-4111-8111-111111111111", "CLI-00101", "2026-Q3"),
    ("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "22222222-2222-4222-8222-222222222222", "CLI-00202", "2026-Q3"),
    ("cccccccc-cccc-4ccc-8ccc-cccccccccccc", "11111111-1111-4111-8111-111111111111", "CLI-00305", "2025-Q1"),
    ("dddddddd-dddd-4ddd-8ddd-dddddddddddd", "11111111-1111-4111-8111-111111111111", "CLI-00412", "2025-Q2"),
    ("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", "22222222-2222-4222-8222-222222222222", "CLI-00523", "2025-Q3"),
    ("ffffffff-ffff-4fff-8fff-ffffffffffff", "22222222-2222-4222-8222-222222222222", "CLI-00634", "2025-Q4"),
    ("12121212-1212-4212-8212-121212121212", "33333333-3333-4333-8333-333333333333", "CLI-00745", "2026-Q1"),
    ("34343434-3434-4434-8434-343434343434", "44444444-4444-4444-8444-444444444444", "CLI-00856", "2026-Q2"),
]

INCOME_SOURCES = [
    ("w2_salary", 500000, 3500000),         # $5k - $35k per payroll event
    ("1099_dividend", 15000, 450000),        # $150 - $4.5k
    ("1099_interest", 5000, 180000),         # $50 - $1.8k
    ("k1_partnership", 500000, 12500000),    # $5k - $125k distribution
    ("capital_gains", 25000, 2500000),       # $250 - $25k
]

# Jurisdictions with leading zeros (e.g. FIPS codes, state taxing units)
JURISDICTION_CODES = [
    "01001", "02020", "04013", "06001", "06037", "06075", "08031", "09001",
    "12086", "13121", "17031", "25025", "36061", "48201", "53033", "00420"
]

NOTES_SAMPLES = [
    "Quarterly payroll direct deposit",
    "Year-end dividend re-investment",
    "Municipal bond tax-exempt interest",
    "LP quarterly distribution tranches",
    "Q3 equity compensation vesting event",
    "Restricted stock unit tax withholding",
    "Advisory fee deduction adjustment",
    None,  # Nullable defect
]


def generate_export_file(
    total_rows: int = 2_000_000,
    seed: int = 42,
    out_dir: Path | None = None,
    filename: str = "income_events.csv.gz",
) -> Path:
    """
    Emits a deterministic gzipped CSV of income events.
    """
    out_dir = out_dir or Path("data/exports")
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / filename

    rng = random.Random(seed)

    start_date = date(2025, 1, 1)
    end_date = date(2026, 9, 30)
    day_span = (end_date - start_date).days

    fieldnames = [
        "event_id",
        "tenant_id",
        "cycle_id",
        "client_id",
        "jurisdiction_code",
        "planning_period",
        "income_source",
        "amount_cents",
        "effective_rate",
        "event_date",
        "notes",
        "created_at",
    ]

    chunk_size = 50_000

    # Ensure byte-level determinism with fixed mtime in gzip
    with gzip.GzipFile(out_path, "wb", mtime=1700000000.0) as gz_file:
        import io
        text_stream = io.TextIOWrapper(gz_file, encoding="utf-8", newline="")
        writer = csv.writer(text_stream)
        writer.writerow(fieldnames)

        rows_written = 0
        while rows_written < total_rows:
            batch_count = min(chunk_size, total_rows - rows_written)
            batch = []

            for i in range(batch_count):
                row_idx = rows_written + i + 1

                # Deterministic UUID-like event ID
                event_id = f"evt_{row_idx:08d}_{rng.randint(100000, 999999)}"

                # Pick cycle
                cycle = rng.choice(SEED_CYCLES)
                cycle_id, tenant_id, client_id, period = cycle

                # Jurisdiction code with preserved leading zeros
                jur_code = rng.choice(JURISDICTION_CODES)

                # Income source & amount
                source_meta = rng.choice(INCOME_SOURCES)
                source_name, min_amt, max_amt = source_meta

                # Defect 1: 0.5% negative adjustments / clawbacks
                if rng.random() < 0.005:
                    amount_cents = -rng.randint(5000, 250000)
                # Defect 2: 0.02% large outlier high-net-worth distribution
                elif rng.random() < 0.0002:
                    amount_cents = rng.randint(25000000, 95000000)  # $250k - $950k
                else:
                    amount_cents = rng.randint(min_amt, max_amt)

                # Effective rate (0.1000 to 0.3700)
                rate = round(rng.uniform(0.1000, 0.3700), 4)

                # Event date
                offset_days = rng.randint(0, day_span)
                evt_date = start_date + timedelta(days=offset_days)
                event_date_str = evt_date.isoformat()

                # Defect 3: Null notes on ~18% of rows
                note_val = rng.choice(NOTES_SAMPLES)
                if rng.random() < 0.15:
                    note_val = ""

                # Created at timestamp
                hour = rng.randint(8, 18)
                minute = rng.randint(0, 59)
                second = rng.randint(0, 59)
                created_ts = f"{event_date_str}T{hour:02d}:{minute:02d}:{second:02d}Z"

                batch.append([
                    event_id,
                    tenant_id,
                    cycle_id,
                    client_id,
                    jur_code,
                    period,
                    source_name,
                    str(amount_cents),
                    f"{rate:.4f}",
                    event_date_str,
                    note_val or "",
                    created_ts,
                ])

            writer.writerows(batch)
            rows_written += batch_count

        text_stream.flush()

    return out_path


def main():
    parser = argparse.ArgumentParser(description="Generate TaxPulse analytical income event export")
    parser.add_argument("--rows", type=int, default=2_000_000, help="Total number of rows to generate (default: 2,000,000)")
    parser.add_argument("--seed", type=int, default=42, help="Deterministic random seed (default: 42)")
    parser.add_argument("--out-dir", type=Path, default=Path("data/exports"), help="Output directory")
    args = parser.parse_args()

    print(f"Generating {args.rows:,} income event rows (seed={args.seed})...")
    path = generate_export_file(total_rows=args.rows, seed=args.seed, out_dir=args.out_dir)
    size_mb = path.stat().st_size / (1024 * 1024)
    print(f"Export generated successfully at: {path} ({size_mb:.2f} MB)")


if __name__ == "__main__":
    main()
