from __future__ import annotations

import argparse
import json
import os
import tomllib
from pathlib import Path
from typing import Iterable

import psycopg
from openai import OpenAI

try:
    from services.retrieval.chunker import RetrievedChunk, chunk_corpus
except ModuleNotFoundError:
    from chunker import RetrievedChunk, chunk_corpus


CONFIG_PATH = Path("services/retrieval/retrieval.toml")
DEFAULT_DATABASE_URL = "postgresql://taxpulse_app@localhost:55433/taxpulse_l"


def load_config(path: Path = CONFIG_PATH) -> dict:
    with path.open("rb") as stream:
        return tomllib.load(stream)


def cache_key(content_hash: str, model: str, dimensions: int) -> str:
    return f"{model}-{dimensions}-{content_hash}.json"


def read_cached_embedding(cache_dir: Path, chunk: RetrievedChunk, model: str, dimensions: int) -> list[float] | None:
    path = cache_dir / cache_key(chunk.content_hash, model, dimensions)
    if not path.exists():
        return None
    payload = json.loads(path.read_text(encoding="utf-8"))
    if payload.get("content_hash") != chunk.content_hash:
        return None
    if payload.get("model") != model or payload.get("dimensions") != dimensions:
        return None
    embedding = payload.get("embedding")
    return embedding if isinstance(embedding, list) else None


def write_cached_embedding(
    cache_dir: Path,
    chunk: RetrievedChunk,
    model: str,
    dimensions: int,
    embedding: list[float],
) -> None:
    cache_dir.mkdir(parents=True, exist_ok=True)
    path = cache_dir / cache_key(chunk.content_hash, model, dimensions)
    path.write_text(
        json.dumps(
            {
                "model": model,
                "dimensions": dimensions,
                "content_hash": chunk.content_hash,
                "embedding": embedding,
            },
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )


def existing_hashes(database_url: str) -> dict[str, str]:
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT chunk_id, content_hash FROM retrieval.corpus_chunk")
            return {chunk_id: content_hash for chunk_id, content_hash in cur.fetchall()}


def uncached_chunks(
    chunks: Iterable[RetrievedChunk],
    cache_dir: Path,
    model: str,
    dimensions: int,
    stored_hashes: dict[str, str],
) -> list[RetrievedChunk]:
    missing: list[RetrievedChunk] = []
    for chunk in chunks:
        if stored_hashes.get(chunk.id) == chunk.content_hash:
            continue
        if read_cached_embedding(cache_dir, chunk, model, dimensions) is None:
            missing.append(chunk)
    return missing


def embed_missing(
    client: OpenAI,
    missing: list[RetrievedChunk],
    cache_dir: Path,
    model: str,
    dimensions: int,
    batch_size: int = 64,
) -> int:
    calls = 0
    for start in range(0, len(missing), batch_size):
        batch = missing[start : start + batch_size]
        response = client.embeddings.create(
            model=model,
            dimensions=dimensions,
            input=[chunk.content for chunk in batch],
        )
        calls += 1
        for chunk, item in zip(batch, response.data, strict=True):
            write_cached_embedding(cache_dir, chunk, model, dimensions, item.embedding)
    return calls


def vector_literal(embedding: list[float]) -> str:
    return "[" + ",".join(str(value) for value in embedding) + "]"


def load_chunks(
    database_url: str,
    chunks: list[RetrievedChunk],
    cache_dir: Path,
    model: str,
    dimensions: int,
) -> int:
    rows = []
    for chunk in chunks:
        embedding = read_cached_embedding(cache_dir, chunk, model, dimensions)
        if embedding is None:
            raise RuntimeError(f"missing cached embedding for {chunk.id}")
        rows.append(
            {
                "chunk_id": chunk.id,
                "tenant_scope": chunk.tenant_scope,
                "source": chunk.source,
                "section": chunk.section,
                "chunk_offset": chunk.offset,
                "content": chunk.content,
                "content_hash": chunk.content_hash,
                "embedding": vector_literal(embedding),
            }
        )

    sql = """
        INSERT INTO retrieval.corpus_chunk (
            chunk_id,
            tenant_scope,
            source,
            section,
            chunk_offset,
            content,
            content_hash,
            search_vector,
            embedding
        )
        VALUES (
            %(chunk_id)s,
            %(tenant_scope)s,
            %(source)s,
            %(section)s,
            %(chunk_offset)s,
            %(content)s,
            %(content_hash)s,
            to_tsvector('english', %(content)s),
            %(embedding)s::vector
        )
        ON CONFLICT (chunk_id) DO UPDATE SET
            tenant_scope = EXCLUDED.tenant_scope,
            source = EXCLUDED.source,
            section = EXCLUDED.section,
            chunk_offset = EXCLUDED.chunk_offset,
            content = EXCLUDED.content,
            content_hash = EXCLUDED.content_hash,
            search_vector = EXCLUDED.search_vector,
            embedding = EXCLUDED.embedding,
            updated_at = now()
        WHERE retrieval.corpus_chunk.content_hash IS DISTINCT FROM EXCLUDED.content_hash
           OR retrieval.corpus_chunk.tenant_scope IS DISTINCT FROM EXCLUDED.tenant_scope
           OR retrieval.corpus_chunk.source IS DISTINCT FROM EXCLUDED.source
           OR retrieval.corpus_chunk.section IS DISTINCT FROM EXCLUDED.section
           OR retrieval.corpus_chunk.chunk_offset IS DISTINCT FROM EXCLUDED.chunk_offset
    """

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.executemany(sql, rows)
        conn.commit()
    return len(rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=CONFIG_PATH)
    parser.add_argument("--database-url", default=os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    config = load_config(args.config)
    corpus_dir = config["corpus"]["dir"]
    max_chars = int(config["chunking"]["max_chars"])
    model = config["embedding"]["model"]
    dimensions = int(config["embedding"]["dimensions"])
    cache_dir = Path(config["embedding"]["cache_dir"])

    chunks = chunk_corpus(corpus_dir, max_chars=max_chars)
    stored_hashes = existing_hashes(args.database_url)
    missing = uncached_chunks(chunks, cache_dir, model, dimensions, stored_hashes)

    api_calls = 0
    if missing:
        if not os.getenv("OPENAI_API_KEY"):
            raise RuntimeError("OPENAI_API_KEY is required to embed uncached chunks")
        api_calls = embed_missing(OpenAI(), missing, cache_dir, model, dimensions)

    loaded = load_chunks(args.database_url, chunks, cache_dir, model, dimensions)
    print(
        f"retrieval load complete: chunks={len(chunks)} loaded={loaded} "
        f"new_embeddings={len(missing)} api_calls={api_calls}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
