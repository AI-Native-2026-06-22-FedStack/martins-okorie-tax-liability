# syntax=docker/dockerfile:1

ARG TAXPULSE_IMAGE_PLATFORM=linux/amd64

FROM --platform=${TAXPULSE_IMAGE_PLATFORM} python:3.13-slim-trixie@sha256:69e18bd8d831d88e0ef70239dc7771ab7c28bc296ae78ac75cde71e60aa4434f AS build
WORKDIR /app

COPY services/compute/requirements.lock /tmp/requirements.lock
RUN python -m pip install --no-cache-dir --require-hashes --target=/opt/python -r /tmp/requirements.lock

COPY services/compute/app /app/services/compute/app
COPY services/compute/main.py /app/services/compute/main.py
COPY packages/shared-schemas/calculation.schema.json /app/packages/shared-schemas/calculation.schema.json

RUN python -m compileall -q /app/services/compute/app

FROM --platform=${TAXPULSE_IMAGE_PLATFORM} gcr.io/distroless/python3-debian13:nonroot@sha256:cf4327dd87975725c44cae784555f91717af87f3d4d941005106401d9e4cf89c AS runtime
WORKDIR /app/services/compute
ENV PYTHONPATH=/opt/python:/app/services/compute
ENV PORT=8000

COPY --from=build /opt/python /opt/python
COPY --from=build /app/services/compute /app/services/compute
COPY --from=build /app/packages /app/packages

EXPOSE 8000
USER nonroot
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 CMD ["/usr/bin/python3", "-c", "import os, sys, urllib.request; port=os.environ.get('PORT','8000'); req=urllib.request.Request(f'http://127.0.0.1:{port}/health'); sys.exit(0 if urllib.request.urlopen(req, timeout=2).status < 500 else 1)"]
CMD ["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
