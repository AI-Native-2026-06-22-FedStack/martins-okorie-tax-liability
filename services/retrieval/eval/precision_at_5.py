from __future__ import annotations

import argparse
import json
from pathlib import Path
from statistics import mean
from typing import Any, Iterable


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    with path.open(encoding="utf-8") as stream:
        return [json.loads(line) for line in stream if line.strip()]


def seed_question_key(row: dict[str, Any]) -> str:
    """Return the identifier used by one seed row."""
    return row["question_id"]


def ranking_ids(rows: list[dict[str, Any]], phase: str) -> list[str]:
    values = rows[phase]
    ids = []
    for value in values:
        if isinstance(value, str):
            ids.append(value)
        else:
            ids.append(value["chunk_id"])
    return ids


def index_rankings(
    rows: list[dict[str, Any]],
) -> dict[str, dict[str, list[str]]]:
    """Map question id -> {'before': [...], 'after': [...]}."""
    return {
        row["question_id"]: {
            "before": ranking_ids(row, "before"),
            "after": ranking_ids(row, "after"),
        }
        for row in rows
    }


def precision_at_k(ranked: Iterable[str], relevant: set[str], k: int = 5) -> float:
    top_k = list(ranked)[:k]
    return sum(chunk_id in relevant for chunk_id in top_k) / k


def score(
    seeds: list[dict[str, Any]],
    rankings: list[dict[str, Any]],
    phase: str,
    k: int = 5,
) -> float:
    ranking_by_question = index_rankings(rankings)
    per_question = []
    for seed in seeds:
        key = seed_question_key(seed)
        relevant = set(seed["relevant_chunk_ids"])
        per_question.append(
            precision_at_k(
                ranking_by_question[key][phase],
                relevant,
                k,
            )
        )
    return mean(per_question)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seeds", type=Path, default=Path("services/retrieval/eval/seed_pairs.jsonl"))
    parser.add_argument("--rankings", type=Path, default=Path("services/retrieval/eval/rankings.jsonl"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    seeds = read_jsonl(args.seeds)
    rankings = read_jsonl(args.rankings)
    print(f"mean precision@5 before: {score(seeds, rankings, 'before'):.3f}")
    print(f"mean precision@5 after:  {score(seeds, rankings, 'after'):.3f}")


if __name__ == "__main__":
    main()
