.PHONY: check

check:
	uv run ruff check src/python/taxpulse_python tests && \
	uv run mypy src/python/taxpulse_python tests && \
	uv run pytest
