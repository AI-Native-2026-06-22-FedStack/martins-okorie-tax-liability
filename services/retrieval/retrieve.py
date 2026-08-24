from __future__ import annotations

import argparse
import os
import tomllib
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

import psycopg
from openai import OpenAI


CONFIG_PATH = Path("services/retrieval/retrieval.toml")
DEFAULT_DATABASE_URL = "postgresql://taxpulse_app@localhost:55433/taxpulse_l"


@dataclass(frozen=True)
class RetrievalCandidate:
    chunk_id: str
    tenant_scope: str
    source: str
    section: str
    chunk_offset: int
    content: str
    leg_rank: int


@dataclass(frozen=True)
class RetrievedResult:
    chunk_id: str
    tenant_scope: str
    source: str
    section: str
    chunk_offset: int
    content: str
    score: float


def load_config(path: Path = CONFIG_PATH) -> dict:
    with path.open("rb") as stream:
        return tomllib.load(stream)


def vector_literal(embedding: Sequence[float]) -> str:
    return "[" + ",".join(str(value) for value in embedding) + "]"


def embed_question(question: str, model: str, dimensions: int) -> list[float]:
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is required for dense retrieval")
    response = OpenAI().embeddings.create(model=model, dimensions=dimensions, input=question)
    return response.data[0].embedding


def _candidate_from_row(row: tuple, rank: int) -> RetrievalCandidate:
    chunk_id, tenant_scope, source, section, chunk_offset, content = row
    return RetrievalCandidate(
        chunk_id=chunk_id,
        tenant_scope=tenant_scope,
        source=source,
        section=section,
        chunk_offset=chunk_offset,
        content=content,
        leg_rank=rank,
    )


def keyword_leg(
    database_url: str,
    tenant_scope: str,
    question: str,
    candidates: int,
) -> list[RetrievalCandidate]:
    exact = f"%{question.strip()}%"
    sql = """
        SELECT chunk_id, tenant_scope, source, section, chunk_offset, content
        FROM retrieval.corpus_chunk
        WHERE tenant_scope IN (%(tenant_scope)s, 'tenant-all')
          AND (
            search_vector @@ websearch_to_tsquery('simple', %(question)s)
            OR section ILIKE %(exact)s
            OR chunk_id ILIKE %(exact)s
          )
        ORDER BY
            CASE
              WHEN section ILIKE %(exact)s OR chunk_id ILIKE %(exact)s THEN 1
              ELSE 0
            END DESC,
            ts_rank_cd(search_vector, websearch_to_tsquery('simple', %(question)s)) DESC,
            chunk_id ASC
        LIMIT %(limit)s
    """
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                sql,
                {
                    "tenant_scope": tenant_scope,
                    "question": question,
                    "exact": exact,
                    "limit": candidates,
                },
            )
            return [_candidate_from_row(row, rank) for rank, row in enumerate(cur.fetchall(), start=1)]


def dense_leg(
    database_url: str,
    tenant_scope: str,
    question_embedding: Sequence[float],
    candidates: int,
) -> list[RetrievalCandidate]:
    sql = """
        SELECT chunk_id, tenant_scope, source, section, chunk_offset, content
        FROM retrieval.corpus_chunk
        WHERE tenant_scope IN (%(tenant_scope)s, 'tenant-all')
        ORDER BY embedding <=> %(embedding)s::vector ASC, chunk_id ASC
        LIMIT %(limit)s
    """
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                sql,
                {
                    "tenant_scope": tenant_scope,
                    "embedding": vector_literal(question_embedding),
                    "limit": candidates,
                },
            )
            return [_candidate_from_row(row, rank) for rank, row in enumerate(cur.fetchall(), start=1)]


def rrf_fuse(
    ranked_lists: Sequence[Sequence[RetrievalCandidate]],
    *,
    rrf_k: int = 60,
    top_k: int = 5,
) -> list[RetrievedResult]:
    scores: defaultdict[str, float] = defaultdict(float)
    candidates_by_id: dict[str, RetrievalCandidate] = {}

    for ranked in ranked_lists:
        for rank, candidate in enumerate(ranked, start=1):
            candidates_by_id.setdefault(candidate.chunk_id, candidate)
            scores[candidate.chunk_id] += 1.0 / (rrf_k + rank)

    ordered = sorted(scores.items(), key=lambda item: (-item[1], item[0]))
    results: list[RetrievedResult] = []
    for chunk_id, score in ordered[:top_k]:
        candidate = candidates_by_id[chunk_id]
        results.append(
            RetrievedResult(
                chunk_id=candidate.chunk_id,
                tenant_scope=candidate.tenant_scope,
                source=candidate.source,
                section=candidate.section,
                chunk_offset=candidate.chunk_offset,
                content=candidate.content,
                score=score,
            )
        )
    return results


def retrieve(
    question: str,
    tenant_scope: str,
    *,
    database_url: str | None = None,
    config_path: Path = CONFIG_PATH,
    candidates: int | None = None,
    top_k: int | None = None,
) -> list[RetrievedResult]:
    config = load_config(config_path)
    database_url = database_url or os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
    candidates = candidates or int(config["retrieval"]["candidates"])
    rrf_k = int(config["retrieval"]["rrf_k"])
    top_k = top_k or int(config["retrieval"]["top_k"])
    model = config["embedding"]["model"]
    dimensions = int(config["embedding"]["dimensions"])

    question_embedding = embed_question(question, model, dimensions)
    keyword_ranked = keyword_leg(database_url, tenant_scope, question, candidates)
    dense_ranked = dense_leg(database_url, tenant_scope, question_embedding, candidates)
    return rrf_fuse([keyword_ranked, dense_ranked], rrf_k=rrf_k, top_k=top_k)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("question")
    parser.add_argument("--tenant", required=True, dest="tenant_scope")
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))
    parser.add_argument("--config", type=Path, default=CONFIG_PATH)
    parser.add_argument("--top-k", type=int)
    parser.add_argument("--candidates", type=int)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    results = retrieve(
        args.question,
        args.tenant_scope,
        database_url=args.database_url,
        config_path=args.config,
        candidates=args.candidates,
        top_k=args.top_k,
    )
    for index, result in enumerate(results, start=1):
        print(
            f"{index}\t{result.score:.6f}\t{result.chunk_id}\t{result.tenant_scope}\t"
            f"{result.source}\t{result.section}\t{result.chunk_offset}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
