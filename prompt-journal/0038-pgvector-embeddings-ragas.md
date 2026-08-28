# Prompt Journal: pgvector, Embeddings & RAGAS

## Entry 1

### Asked

Save the Week 9 Day 4 "pgvector, Embeddings & RAGAS" lesson material into `helper/` and start a new prompt journal.

### Produced

1. Saved the formatted Week 9 Day 4 lesson content to `helper/week-9-day-4-pgvector-embeddings-ragas.md`.
2. Initialized `prompt-journal/0038-pgvector-embeddings-ragas.md` as the next sequential prompt journal file.

### Accepted or rejected

Accepted

### Why

The lesson reference material was preserved in `helper/week-9-day-4-pgvector-embeddings-ragas.md` and a new sequential prompt journal was created adhering to the repository's journal standards.

## Entry 2

### Asked

Verify Deliverable 3 retriever presence and seed pairs, install and verify RAGAS / OpenAI imports, check shell / environment secret configuration, verify Module 3 boundary redactor importability, verify FastAPI compute service and React SPA test suites, verify audit schema presence, bootstrap directory layout (`services/retrieval/safety`, `.github/workflows`), and create `thresholds.toml` and `injection_categories.md` starter files.

### Produced

1. Installed `ragas` and its dependencies in the workspace toolchain and verified `uv run python -c "import ragas, openai; print('libraries ok')"` succeeds cleanly.
2. Verified Deliverable 3 retriever modules (`chunker.py`, `embed.py`, `retrieve.py`, `rerank.py`) and 12 judged seed questions in `services/retrieval/eval/seed_pairs.jsonl`.
3. Verified Module 3 boundary redactor (`REDACT_KEYS`, `redact_processor`) from `services.compute.app.logging_config` is importable and all 48 compute tests pass.
4. Verified React SPA test suite with all 75 Vitest tests passing across 19 suites.
5. Created `services/retrieval/eval/thresholds.toml` with the program's quality bar (`faithfulness = 0.85`, `answer_relevancy = 0.85`, `context_precision = 0.80`, `judge_model = "gpt-4o-mini"`) and versioned set filenames.
6. Created `services/retrieval/safety/injection_categories.md` starter structure and created `services/retrieval/safety` and `.github/workflows` directories.
7. Verified `OPENAI_API_KEY` configuration is cleanly loaded from environment / `.env.local` without committing any secrets.

### Accepted or rejected

Accepted

### Why

All Deliverable 4 prerequisites and bootstrap smoke tests were successfully verified, required starter files and directories were provisioned, and all test suites in compute and web passed.
