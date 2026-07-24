FROM cgr.dev/chainguard/wolfi-base:latest@sha256:02dab76bd852a70556b5b2002195c8a5fdab77d323c433bf6642aab080489795 AS base

# Package installation needs root; the final process remains the fixed non-root UID.
USER 0
RUN apk upgrade --no-cache \
    && apk add --no-cache ffmpeg python-3.11 py3.11-pip

WORKDIR /app

COPY requirements.txt .
RUN python3.11 -m venv /app/venv \
    && /app/venv/bin/pip install --no-cache-dir --upgrade pip setuptools wheel \
    && /app/venv/bin/pip install --no-cache-dir -r requirements.txt \
    && /app/venv/bin/pip uninstall --yes pip setuptools wheel \
    && apk del py3.11-pip

ENV PATH="/app/venv/bin:$PATH"

COPY app/ ./app/

RUN mkdir -p /tmp/video-moderator \
    && chown -R 65532:65532 /app /tmp/video-moderator
USER 65532

EXPOSE 8100

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python3.11 -c "import urllib.request; urllib.request.urlopen('http://localhost:8100/health')" || exit 1

CMD ["python3.11", "-m", "app.main"]
