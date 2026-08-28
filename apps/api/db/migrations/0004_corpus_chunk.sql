CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS retrieval;

CREATE TABLE IF NOT EXISTS retrieval.corpus_chunk (
    chunk_id text PRIMARY KEY,
    tenant_scope text NOT NULL,
    source text NOT NULL,
    section text NOT NULL,
    chunk_offset integer NOT NULL CHECK (chunk_offset >= 0),
    content text NOT NULL CHECK (length(content) > 0),
    content_hash text NOT NULL CHECK (length(content_hash) = 64),
    search_vector tsvector NOT NULL,
    embedding vector(1536) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT corpus_chunk_source_section_offset_unique
        UNIQUE (source, section, chunk_offset),
    CONSTRAINT corpus_chunk_section_matches_chunk_id
        CHECK (chunk_id LIKE section || '-%')
);

CREATE INDEX IF NOT EXISTS corpus_chunk_tenant_section_idx
    ON retrieval.corpus_chunk (tenant_scope, section);

CREATE INDEX IF NOT EXISTS corpus_chunk_content_hash_idx
    ON retrieval.corpus_chunk (content_hash);

CREATE INDEX IF NOT EXISTS corpus_chunk_search_vector_idx
    ON retrieval.corpus_chunk
    USING gin (search_vector);
