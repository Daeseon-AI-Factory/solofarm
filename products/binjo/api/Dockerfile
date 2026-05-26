FROM python:3.11-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Layer 1: install factory-core (the shared package at repo root)
# Build context for this Dockerfile is the REPO ROOT (see docker-compose.yml),
# so we can COPY from the monorepo's top-level paths.
COPY pyproject.toml .
COPY core/ ./core/
RUN pip install --no-cache-dir -e .

# Layer 2: install binjo-api dependencies
COPY products/binjo/api/pyproject.toml ./products/binjo/api/
WORKDIR /app/products/binjo/api
RUN pip install --no-cache-dir -e .

# Layer 3: copy binjo source
COPY products/binjo/api/ .

# Railway sets PORT env var automatically
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
