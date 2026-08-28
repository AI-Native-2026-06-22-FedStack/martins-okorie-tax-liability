from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence


CORPUS_DIR = Path("data/corpus")
MIN_DOCUMENTS = 10
MAX_DOCUMENTS = 12
FICTIONAL_ISSUER = "Fictional TaxPulse Planning Board"
SECTION_ID_RE = re.compile(r"^#{2,3}\s+(TPX-(?:RP|PB)-\d{3}-[A-Z])\b")
FRONT_MATTER_RE = re.compile(r"\A---\n(?P<body>.*?)\n---\n", re.DOTALL)
REQUIRED_FRONT_MATTER = {
    "synthetic": "true",
    "fictional_issuer": FICTIONAL_ISSUER,
    "invented_rates_and_limits": "true",
    "tenant_scope": None,
    "tenant_segment": None,
    "document_type": None,
    "document_id": None,
}
ALLOWED_TENANT_SCOPES = {
    "tenant-alpha-advisory",
    "tenant-beta-family-office",
    "tenant-gamma-ria",
    "tenant-all",
}
ALLOWED_TENANT_SEGMENTS = {"RIA", "MFO", "HNW", "All"}
REQUIRED_TABLE_SECTIONS = {
    "TPX-RP-001-B",
    "TPX-RP-002-B",
    "TPX-RP-003-B",
    "TPX-RP-004-B",
    "TPX-RP-005-B",
    "TPX-RP-005-C",
    "TPX-RP-006-B",
}
NEAR_DUPLICATE_GROUPS = {
    "ND-FILING-RESERVE": {"TPX-RP-001-B", "TPX-RP-002-B"},
    "ND-BUFFER-LIMIT": {"TPX-RP-003-B", "TPX-RP-004-B"},
    "ND-EFFECTIVE-STATUS": {"TPX-RP-005-B", "TPX-RP-005-C"},
}
SUPERSEDED_SECTION = "TPX-RP-005-B"
REPLACEMENT_SECTION = "TPX-RP-005-C"


@dataclass(frozen=True)
class CorpusDocument:
    path: Path
    text: str


def load_documents(corpus_dir: Path = CORPUS_DIR) -> list[CorpusDocument]:
    """Load corpus Markdown; keep parsing choices in the checks below."""
    return [
        CorpusDocument(path=path, text=path.read_text(encoding="utf-8"))
        for path in sorted(corpus_dir.glob("*.md"))
        if path.name != "CORPUS-SPEC.md"
    ]


def parse_front_matter(document: CorpusDocument) -> tuple[dict[str, str], str]:
    match = FRONT_MATTER_RE.match(document.text)
    if not match:
        return {}, document.text
    metadata: dict[str, str] = {}
    for line in match.group("body").splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        metadata[key.strip()] = value.strip().strip('"').strip("'")
    return metadata, document.text[match.end() :]


def section_blocks(text: str) -> dict[str, str]:
    blocks: dict[str, list[str]] = {}
    current_id: str | None = None
    for line in text.splitlines():
        heading_match = SECTION_ID_RE.match(line)
        if heading_match:
            current_id = heading_match.group(1)
            blocks[current_id] = [line]
            continue
        if current_id:
            blocks[current_id].append(line)
    return {section_id: "\n".join(lines) for section_id, lines in blocks.items()}


def heading_lines(text: str) -> list[str]:
    return [line for line in text.splitlines() if line.startswith(("## ", "### "))]


def has_threshold_table(block: str) -> bool:
    table_lines = [line for line in block.splitlines() if "|" in line]
    has_separator = any(re.search(r"\|\s*-{3,}", line) for line in table_lines)
    has_numeric_value = any(re.search(r"\|\s*[^|]*\d", line) for line in table_lines)
    return has_separator and has_numeric_value


def check_document(document: CorpusDocument) -> Iterable[str]:
    """Yield '<path>: <problem>' messages for document-level failures."""
    metadata, body = parse_front_matter(document)

    for key, expected in REQUIRED_FRONT_MATTER.items():
        value = metadata.get(key)
        if value is None:
            yield f"{document.path}: missing front matter field '{key}'"
        elif expected is not None and value != expected:
            yield f"{document.path}: front matter '{key}' expected '{expected}', found '{value}'"

    if metadata.get("tenant_scope") not in ALLOWED_TENANT_SCOPES:
        yield f"{document.path}: tenant_scope is missing or not in the allowed synthetic tenant set"
    if metadata.get("tenant_segment") not in ALLOWED_TENANT_SEGMENTS:
        yield f"{document.path}: tenant_segment is missing or not in the allowed segment set"

    lowered = document.text.lower()
    if "synthetic training material" not in lowered:
        yield f"{document.path}: missing synthetic training label"
    if "fictional taxpulse planning board" not in lowered:
        yield f"{document.path}: missing fictional issuing authority label"
    if "invented" not in lowered or "real tax law" not in lowered:
        yield f"{document.path}: missing invented-rates disclaimer"

    headings = heading_lines(body)
    if not headings:
        yield f"{document.path}: expected at least one H2 or H3 section heading"
    for line in headings:
        if not SECTION_ID_RE.match(line):
            yield f"{document.path}: section heading lacks stable synthetic id: {line}"

    blocks = section_blocks(body)
    for required_id in REQUIRED_TABLE_SECTIONS.intersection(blocks):
        if not has_threshold_table(blocks[required_id]):
            yield f"{document.path}: section {required_id} is listed as table-bearing but has no numeric table"


def all_section_blocks(documents: Sequence[CorpusDocument]) -> dict[str, tuple[Path, str]]:
    blocks: dict[str, tuple[Path, str]] = {}
    for document in documents:
        _, body = parse_front_matter(document)
        for section_id, block in section_blocks(body).items():
            blocks[section_id] = (document.path, block)
    return blocks


def check_corpus_wide(documents: Sequence[CorpusDocument]) -> Iterable[str]:
    """Yield failures that require comparing documents with one another."""
    seen: dict[str, Path] = {}
    duplicates: set[str] = set()
    all_blocks: dict[str, tuple[Path, str]] = {}

    for document in documents:
        _, body = parse_front_matter(document)
        for section_id, block in section_blocks(body).items():
            if section_id in seen:
                duplicates.add(section_id)
                yield f"{document.path}: duplicate section id {section_id}; first seen in {seen[section_id]}"
            seen[section_id] = document.path
            all_blocks[section_id] = (document.path, block)

    if not duplicates and not seen:
        yield f"{CORPUS_DIR}: no section identifiers found"

    table_sections = {
        section_id
        for section_id, (_path, block) in all_blocks.items()
        if has_threshold_table(block)
    }
    if len(table_sections) < 5:
        yield f"{CORPUS_DIR}: expected at least 5 threshold-table sections; found {len(table_sections)}"

    missing_table_sections = REQUIRED_TABLE_SECTIONS - table_sections
    for section_id in sorted(missing_table_sections):
        yield f"{CORPUS_DIR}: required threshold-table section {section_id} is missing or has no table"

    for marker, expected_ids in NEAR_DUPLICATE_GROUPS.items():
        found_ids = {
            section_id
            for section_id, (_path, block) in all_blocks.items()
            if f"Near-duplicate marker: `{marker}`" in block
        }
        if found_ids != expected_ids:
            yield (
                f"{CORPUS_DIR}: near-duplicate group {marker} expected "
                f"{sorted(expected_ids)}, found {sorted(found_ids)}"
            )

    superseded = all_blocks.get(SUPERSEDED_SECTION)
    if superseded is None or "SUPERSEDED-PROVISION" not in superseded[1] or "2025-01-01" not in superseded[1]:
        yield f"{CORPUS_DIR}: superseded provision {SUPERSEDED_SECTION} missing required marker/effective date"

    replacement = all_blocks.get(REPLACEMENT_SECTION)
    if replacement is None or "REPLACEMENT-PROVISION" not in replacement[1] or "2026-01-01" not in replacement[1]:
        yield f"{CORPUS_DIR}: replacement provision {REPLACEMENT_SECTION} missing required marker/effective date"


def check_corpus(documents: Sequence[CorpusDocument]) -> list[str]:
    """Run count, document-level, and corpus-wide checks."""
    failures: list[str] = []
    if not MIN_DOCUMENTS <= len(documents) <= MAX_DOCUMENTS:
        failures.append(
            f"{CORPUS_DIR}: expected {MIN_DOCUMENTS}-{MAX_DOCUMENTS} documents; found {len(documents)}"
        )

    for document in documents:
        failures.extend(check_document(document))

    failures.extend(check_corpus_wide(documents))
    return failures


def main() -> int:
    failures = check_corpus(load_documents())
    if failures:
        print("Corpus acceptance check FAILED")
        for failure in failures:
            print(f"- {failure}")
        return 1
    print("Corpus acceptance check PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
