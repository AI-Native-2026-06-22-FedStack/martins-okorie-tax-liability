from __future__ import annotations

import re

from services.retrieval.chunker import chunk_corpus, configured_max_chars


def test_no_chunk_exceeds_configured_maximum() -> None:
    max_chars = configured_max_chars()
    chunks = chunk_corpus(max_chars=max_chars)

    assert chunks
    assert all(len(chunk.content) <= max_chars for chunk in chunks)


def test_no_heading_is_orphaned_from_body() -> None:
    chunks = chunk_corpus()

    for chunk in chunks:
        lines = [line for line in chunk.content.splitlines() if line.strip()]
        assert lines, chunk.id
        assert re.match(r"^#{2,3}\s+TPX-(?:RP|PB)-\d{3}-[A-Z]\b", lines[0]), chunk.id
        assert len(lines) > 1, f"{chunk.id} has a heading with no body"


def test_every_chunk_has_complete_provenance() -> None:
    chunks = chunk_corpus()

    for chunk in chunks:
        assert chunk.id
        assert chunk.source.endswith(".md")
        assert chunk.section.startswith(("TPX-RP-", "TPX-PB-"))
        assert chunk.offset >= 0
        assert chunk.tenant_scope.startswith("tenant-")
        assert chunk.content_hash
