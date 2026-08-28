from __future__ import annotations

import os

import pytest

from services.retrieval.retrieve import (
    RetrievalCandidate,
    keyword_leg,
    retrieve,
    rrf_fuse,
)


def candidate(chunk_id: str, rank: int, tenant_scope: str = "tenant-alpha-advisory") -> RetrievalCandidate:
    return RetrievalCandidate(
        chunk_id=chunk_id,
        tenant_scope=tenant_scope,
        source=f"data/corpus/{chunk_id}.md",
        section=chunk_id.rsplit("-", 1)[0],
        chunk_offset=rank - 1,
        content=f"content for {chunk_id}",
        leg_rank=rank,
    )


def test_rrf_fuses_by_rank_not_raw_score() -> None:
    results = rrf_fuse(
        [
            [candidate("A", 1), candidate("B", 2)],
            [candidate("B", 1), candidate("A", 2)],
        ],
        rrf_k=60,
        top_k=2,
    )

    assert [result.chunk_id for result in results] == ["A", "B"]
    assert results[0].score == pytest.approx((1 / 61) + (1 / 62))
    assert results[1].score == pytest.approx((1 / 62) + (1 / 61))


def test_rrf_result_carries_score_and_full_provenance() -> None:
    result = rrf_fuse([[candidate("TPX-RP-001-B-001", 1)]], rrf_k=60, top_k=1)[0]

    assert result.score > 0
    assert result.chunk_id == "TPX-RP-001-B-001"
    assert result.tenant_scope == "tenant-alpha-advisory"
    assert result.source.endswith(".md")
    assert result.section == "TPX-RP-001-B"
    assert result.chunk_offset == 0
    assert result.content


@pytest.mark.skipif(not os.getenv("DATABASE_URL"), reason="DATABASE_URL is required")
def test_keyword_leg_is_tenant_scoped() -> None:
    results = keyword_leg(
        os.environ["DATABASE_URL"],
        "tenant-alpha-advisory",
        "TPX-RP-002-B",
        candidates=20,
    )

    assert all(result.tenant_scope in {"tenant-alpha-advisory", "tenant-all"} for result in results)
    assert all(result.section != "TPX-RP-002-B" for result in results)


@pytest.mark.skipif(not os.getenv("DATABASE_URL"), reason="DATABASE_URL is required")
def test_hnsw_index_scan_query_plan() -> None:
    import psycopg

    database_url = os.environ["DATABASE_URL"]
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT embedding FROM retrieval.corpus_chunk LIMIT 1;")
            row = cur.fetchone()
            assert row is not None, "retrieval.corpus_chunk must contain seeded rows"
            sample_embedding = row[0]

            # In small tables (e.g. 31 rows), Postgres optimizer prefers Seq Scan unless seqscan is disabled
            cur.execute("SET enable_seqscan = off;")
            cur.execute(
                """
                EXPLAIN (ANALYZE, BUFFERS)
                SELECT chunk_id, content
                FROM retrieval.corpus_chunk
                ORDER BY embedding <=> %s::vector
                LIMIT 10;
                """,
                (sample_embedding,),
            )
            plan_lines = [r[0] for r in cur.fetchall()]
            plan_text = "\n".join(plan_lines)

            assert "corpus_chunk_embedding_hnsw_idx" in plan_text
            assert "Index Scan" in plan_text


@pytest.mark.skipif(
    not os.getenv("DATABASE_URL") or not os.getenv("OPENAI_API_KEY"),
    reason="DATABASE_URL and OPENAI_API_KEY are required",
)
def test_retrieve_is_tenant_scoped() -> None:
    results = retrieve(
        "joint filer advisory deduction reserve TPX-RP-002-B",
        "tenant-alpha-advisory",
        database_url=os.environ["DATABASE_URL"],
    )

    assert results
    assert all(result.tenant_scope in {"tenant-alpha-advisory", "tenant-all"} for result in results)
    assert all(result.section != "TPX-RP-002-B" for result in results)


