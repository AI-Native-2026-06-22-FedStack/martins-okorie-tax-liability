-- path: apps/api/db/migrations/0005_chunk_vector_index.sql
-- HNSW cosine distance index for dense retrieval on corpus_chunk

CREATE INDEX IF NOT EXISTS corpus_chunk_embedding_hnsw_idx
ON retrieval.corpus_chunk
USING hnsw (embedding vector_cosine_ops)
WITH (
    m = 16,
    ef_construction = 64
);
