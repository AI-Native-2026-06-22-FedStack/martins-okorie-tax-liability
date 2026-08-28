from __future__ import annotations

import argparse
import hashlib
import json
import os
import tomllib
from pathlib import Path
from typing import Any, Sequence

import psycopg
from openai import OpenAI

from services.retrieval.retrieve import RetrievedResult, retrieve


CONFIG_PATH = Path("services/retrieval/retrieval.toml")
SEED_PATH = Path("services/retrieval/eval/seed_pairs.jsonl")
RANKINGS_PATH = Path("services/retrieval/eval/rankings.jsonl")
POOL_PATH = Path("services/retrieval/eval/pool.jsonl")
DEFAULT_DATABASE_URL = "postgresql://taxpulse_app@localhost:55433/taxpulse_l"


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as stream:
        return [json.loads(line) for line in stream if line.strip()]


def write_jsonl(path: Path, rows: Sequence[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as stream:
        for row in rows:
            stream.write(json.dumps(row, sort_keys=True) + "\n")


def load_config(path: Path = CONFIG_PATH) -> dict:
    with path.open("rb") as stream:
        return tomllib.load(stream)


def get_content_hashes(database_url: str, chunk_ids: Sequence[str]) -> dict[str, str]:
    if not chunk_ids:
        return {}
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT chunk_id, content_hash
                FROM retrieval.corpus_chunk
                WHERE chunk_id = ANY(%s)
                """,
                (list(chunk_ids),),
            )
            return {chunk_id: content_hash for chunk_id, content_hash in cur.fetchall()}


def result_to_record(result: RetrievedResult) -> dict[str, Any]:
    return {
        "chunk_id": result.chunk_id,
        "tenant_scope": result.tenant_scope,
        "source": result.source,
        "section": result.section,
        "chunk_offset": result.chunk_offset,
        "score": result.score,
        "content": result.content,
    }


def cache_namespace(cache_dir: Path, resolved_model_id: str, prompt_version: str) -> Path:
    return cache_dir / resolved_model_id / prompt_version


def discover_cached_resolved_model_id(cache_dir: Path, prompt_version: str) -> str | None:
    if not cache_dir.exists():
        return None
    resolved_ids = [
        path.name
        for path in cache_dir.iterdir()
        if path.is_dir() and (path / prompt_version).is_dir()
    ]
    if len(resolved_ids) == 1:
        return resolved_ids[0]
    return None


def cache_key(
    question: str,
    candidates: Sequence[dict[str, Any]],
    content_hashes: dict[str, str],
    resolved_model_id: str,
    prompt_version: str,
    rerank_config: dict[str, Any],
) -> str:
    payload = {
        "question": question,
        "candidate_ids": [candidate["chunk_id"] for candidate in candidates],
        "candidate_content_hashes": [
            content_hashes[candidate["chunk_id"]]
            for candidate in candidates
        ],
        "resolved_model_id": resolved_model_id,
        "prompt_version": prompt_version,
        "rerank_config": rerank_config,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest() + ".json"


def build_prompt(question: str, candidates: Sequence[dict[str, Any]]) -> str:
    candidate_lines = []
    for index, candidate in enumerate(candidates, start=1):
        candidate_lines.append(
            "\n".join(
                [
                    f"{index}. chunk_id: {candidate['chunk_id']}",
                    f"   section: {candidate['section']}",
                    f"   source: {candidate['source']}",
                    f"   content: {candidate['content']}",
                ]
            )
        )
    return "\n\n".join(
        [
            "You are reranking retrieval candidates for a synthetic TaxPulse planning corpus.",
            "Order candidates by how directly they answer the advisor question.",
            "Score against the question only. Do not use or mention retrieval scores.",
            "Return strict JSON with one field: ordered_chunk_ids, an array of chunk_id strings.",
            f"Question: {question}",
            "Candidates:",
            "\n\n".join(candidate_lines),
        ]
    )


def parse_ordering(raw_content: str, candidate_ids: Sequence[str]) -> list[str]:
    payload = json.loads(raw_content)
    ordered = payload.get("ordered_chunk_ids")
    if not isinstance(ordered, list):
        raise ValueError("rerank response missing ordered_chunk_ids list")
    allowed = set(candidate_ids)
    deduped = []
    for chunk_id in ordered:
        if chunk_id in allowed and chunk_id not in deduped:
            deduped.append(chunk_id)
    deduped.extend(chunk_id for chunk_id in candidate_ids if chunk_id not in deduped)
    return deduped


def cached_ordering(
    *,
    cache_dir: Path,
    resolved_model_id: str,
    prompt_version: str,
    question: str,
    candidates: Sequence[dict[str, Any]],
    content_hashes: dict[str, str],
    rerank_config: dict[str, Any],
) -> list[str] | None:
    cache_path = cache_namespace(cache_dir, resolved_model_id, prompt_version) / cache_key(
        question,
        candidates,
        content_hashes,
        resolved_model_id,
        prompt_version,
        rerank_config,
    )
    if not cache_path.exists():
        return None
    payload = json.loads(cache_path.read_text(encoding="utf-8"))
    ordered = payload.get("ordered_chunk_ids")
    return ordered if isinstance(ordered, list) else None


def write_cache(
    *,
    cache_dir: Path,
    resolved_model_id: str,
    prompt_version: str,
    question_id: str,
    question: str,
    candidates: Sequence[dict[str, Any]],
    content_hashes: dict[str, str],
    rerank_config: dict[str, Any],
    ordered: Sequence[str],
) -> None:
    namespace = cache_namespace(cache_dir, resolved_model_id, prompt_version)
    namespace.mkdir(parents=True, exist_ok=True)
    cache_path = namespace / cache_key(
        question,
        candidates,
        content_hashes,
        resolved_model_id,
        prompt_version,
        rerank_config,
    )
    cache_path.write_text(
        json.dumps(
            {
                "question_id": question_id,
                "resolved_model_id": resolved_model_id,
                "ordered_chunk_ids": list(ordered),
                "candidate_ids": [candidate["chunk_id"] for candidate in candidates],
            },
            sort_keys=True,
        ),
        encoding="utf-8",
    )


def rerank_one(
    *,
    client: OpenAI,
    question_id: str,
    question: str,
    candidates: Sequence[dict[str, Any]],
    content_hashes: dict[str, str],
    configured_model: str,
    resolved_model_id: str | None,
    prompt_version: str,
    cache_dir: Path,
    rerank_config: dict[str, Any],
) -> tuple[list[str], str, int]:
    if resolved_model_id:
        cached = cached_ordering(
            cache_dir=cache_dir,
            resolved_model_id=resolved_model_id,
            prompt_version=prompt_version,
            question=question,
            candidates=candidates,
            content_hashes=content_hashes,
            rerank_config=rerank_config,
        )
        if cached is not None:
            return cached, resolved_model_id, 0

    candidate_ids = [candidate["chunk_id"] for candidate in candidates]
    response = client.chat.completions.create(
        model=configured_model,
        messages=[
            {"role": "system", "content": "You produce JSON rerank orderings for retrieval candidates."},
            {"role": "user", "content": build_prompt(question, candidates)},
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )
    response_content = response.choices[0].message.content or "{}"
    resolved = response.model
    ordered = parse_ordering(response_content, candidate_ids)
    write_cache(
        cache_dir=cache_dir,
        resolved_model_id=resolved,
        prompt_version=prompt_version,
        question_id=question_id,
        question=question,
        candidates=candidates,
        content_hashes=content_hashes,
        rerank_config=rerank_config,
        ordered=ordered,
    )
    return ordered, resolved, 1


def generate_rankings(
    *,
    seeds_path: Path = SEED_PATH,
    rankings_path: Path = RANKINGS_PATH,
    pool_path: Path = POOL_PATH,
    database_url: str | None = None,
    config_path: Path = CONFIG_PATH,
) -> dict[str, Any]:
    database_url = database_url or os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
    config = load_config(config_path)
    rerank_config = {"candidate_count": 10, "temperature": 0}
    prompt_version = config["rerank"]["prompt_version"]
    configured_model = config["rerank"]["model"]
    cache_dir = Path(config["rerank"]["cache_dir"])

    seeds = read_jsonl(seeds_path)
    client = OpenAI()
    rankings: list[dict[str, Any]] = []
    pools: list[dict[str, Any]] = []
    resolved_model_id = discover_cached_resolved_model_id(cache_dir, prompt_version)
    api_calls = 0

    for seed in seeds:
        before_results = retrieve(
            seed["question"],
            seed["tenant_scope"],
            database_url=database_url,
            config_path=config_path,
            candidates=int(config["retrieval"]["candidates"]),
            top_k=rerank_config["candidate_count"],
        )
        before_candidates = [result_to_record(result) for result in before_results]
        content_hashes = get_content_hashes(
            database_url,
            [candidate["chunk_id"] for candidate in before_candidates],
        )
        after_ids, resolved_model_id, calls = rerank_one(
            client=client,
            question_id=seed["question_id"],
            question=seed["question"],
            candidates=before_candidates,
            content_hashes=content_hashes,
            configured_model=configured_model,
            resolved_model_id=resolved_model_id,
            prompt_version=prompt_version,
            cache_dir=cache_dir,
            rerank_config=rerank_config,
        )
        api_calls += calls
        before_by_id = {candidate["chunk_id"]: candidate for candidate in before_candidates}
        after_candidates = [before_by_id[chunk_id] for chunk_id in after_ids if chunk_id in before_by_id]
        pool_ids = []
        for chunk_id in [*before_by_id.keys(), *after_ids, seed["expected_chunk_id"]]:
            if chunk_id not in pool_ids:
                pool_ids.append(chunk_id)

        rankings.append(
            {
                "question_id": seed["question_id"],
                "tenant_scope": seed["tenant_scope"],
                "question": seed["question"],
                "expected_chunk_id": seed["expected_chunk_id"],
                "resolved_model_id": resolved_model_id,
                "before": before_candidates,
                "after": after_candidates,
            }
        )
        pools.append(
            {
                "question_id": seed["question_id"],
                "pool_chunk_ids": pool_ids,
                "expected_chunk_id": seed["expected_chunk_id"],
                "relevant_chunk_ids": seed["relevant_chunk_ids"],
            }
        )

    write_jsonl(rankings_path, rankings)
    write_jsonl(pool_path, pools)
    return {
        "questions": len(seeds),
        "api_calls": api_calls,
        "resolved_model_id": resolved_model_id or "",
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seeds", type=Path, default=SEED_PATH)
    parser.add_argument("--rankings", type=Path, default=RANKINGS_PATH)
    parser.add_argument("--pool", type=Path, default=POOL_PATH)
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))
    parser.add_argument("--config", type=Path, default=CONFIG_PATH)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    summary = generate_rankings(
        seeds_path=args.seeds,
        rankings_path=args.rankings,
        pool_path=args.pool,
        database_url=args.database_url,
        config_path=args.config,
    )
    print(
        "rerank complete: "
        f"questions={summary['questions']} api_calls={summary['api_calls']} "
        f"resolved_model_id={summary['resolved_model_id']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
