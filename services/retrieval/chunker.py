from __future__ import annotations

import hashlib
import re
import tomllib
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


CONFIG_PATH = Path("services/retrieval/retrieval.toml")
SECTION_HEADING_RE = re.compile(r"^(?P<level>#{2,3})\s+(?P<section>TPX-(?:RP|PB)-\d{3}-[A-Z])\b")
FRONT_MATTER_RE = re.compile(r"\A---\n(?P<body>.*?)\n---\n", re.DOTALL)


@dataclass(frozen=True)
class RetrievedChunk:
    id: str
    tenant_scope: str
    source: str
    section: str
    offset: int
    content: str
    content_hash: str


def load_config(path: Path = CONFIG_PATH) -> dict:
    with path.open("rb") as stream:
        return tomllib.load(stream)


def configured_max_chars(path: Path = CONFIG_PATH) -> int:
    return int(load_config(path)["chunking"]["max_chars"])


def parse_front_matter(text: str) -> tuple[dict[str, str], str]:
    match = FRONT_MATTER_RE.match(text)
    if not match:
        return {}, text

    metadata: dict[str, str] = {}
    for line in match.group("body").splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        metadata[key.strip()] = value.strip().strip('"').strip("'")
    return metadata, text[match.end() :]


def corpus_paths(corpus_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in corpus_dir.glob("*.md")
        if path.name != "CORPUS-SPEC.md"
    )


def content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _section_chunks(body: str) -> Iterable[tuple[str, str]]:
    current_section: str | None = None
    current_lines: list[str] = []

    for line in body.splitlines():
        heading = SECTION_HEADING_RE.match(line)
        if heading:
            if current_section is not None:
                yield current_section, "\n".join(current_lines).strip()
            current_section = heading.group("section")
            current_lines = [line]
            continue

        if current_section is not None:
            current_lines.append(line)

    if current_section is not None:
        yield current_section, "\n".join(current_lines).strip()


def chunk_document(path: Path, max_chars: int) -> list[RetrievedChunk]:
    text = path.read_text(encoding="utf-8")
    metadata, body = parse_front_matter(text)
    tenant_scope = metadata.get("tenant_scope")
    if not tenant_scope:
        raise ValueError(f"{path}: missing tenant_scope front matter")

    chunks: list[RetrievedChunk] = []
    for offset, (section, content) in enumerate(_section_chunks(body)):
        if not content:
            raise ValueError(f"{path}: section {section} produced an empty chunk")
        if len(content) > max_chars:
            raise ValueError(
                f"{path}: section {section} exceeds max_chars={max_chars} "
                f"with {len(content)} chars"
            )

        chunk_id = f"{section}-{offset:03d}"
        chunks.append(
            RetrievedChunk(
                id=chunk_id,
                tenant_scope=tenant_scope,
                source=str(path),
                section=section,
                offset=offset,
                content=content,
                content_hash=content_hash(content),
            )
        )
    return chunks


def chunk_corpus(corpus_dir: Path | str = "data/corpus", max_chars: int | None = None) -> list[RetrievedChunk]:
    corpus_path = Path(corpus_dir)
    if max_chars is None:
        max_chars = configured_max_chars()

    chunks: list[RetrievedChunk] = []
    for path in corpus_paths(corpus_path):
        chunks.extend(chunk_document(path, max_chars))
    return chunks


if __name__ == "__main__":
    for chunk in chunk_corpus():
        print(f"{chunk.id}\t{chunk.tenant_scope}\t{chunk.source}\t{chunk.section}\t{len(chunk.content)}")
