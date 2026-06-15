FROM python:3.11-slim AS base

# Install system dependencies: ffmpeg for frame extraction
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ffmpeg \
        libpq-dev \
        gcc \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies separately for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY app/ ./app/

# Create tmp directory
RUN mkdir -p /tmp/video-moderator

# Non-root user for security
RUN addgroup --system moderator && adduser --system --ingroup moderator moderator
RUN chown -R moderator:moderator /app /tmp/video-moderator
USER moderator

EXPOSE 8100

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8100/health')" || exit 1

CMD ["python", "-m", "app.main"]
