.PHONY: check

check:
	uv run --locked ruff check src/python/taxpulse_python tests && \
	uv run --locked mypy src/python/taxpulse_python tests && \
	uv run --locked pytest
