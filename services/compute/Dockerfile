FROM python:3.13-slim
WORKDIR /app
COPY pyproject.toml ./
RUN pip install uvicorn fastapi pydantic httpx structlog cryptography pyjwt jsonschema tenacity
COPY . ./
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
