"""FastAPI application entry point — health check and Kafka consumer lifecycle."""

import asyncio
import logging
import os

import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.consumer import ModerationConsumer

logger = logging.getLogger(__name__)

app = FastAPI(title="video-moderator", version="1.0.0")

_consumer: ModerationConsumer | None = None
_consumer_task: asyncio.Task | None = None


@app.on_event("startup")
async def startup() -> None:
    settings = get_settings()
    os.makedirs(settings.tmp_dir, exist_ok=True)

    global _consumer, _consumer_task
    _consumer = ModerationConsumer(settings)
    _consumer_task = asyncio.create_task(_consumer.start())
    logger.info("Moderation consumer started")


@app.on_event("shutdown")
async def shutdown() -> None:
    if _consumer:
        await _consumer.stop()
    if _consumer_task:
        _consumer_task.cancel()
        try:
            await _consumer_task
        except asyncio.CancelledError:
            pass
    logger.info("Moderation consumer stopped")


@app.get("/health")
async def health() -> JSONResponse:
    """Liveness probe used by Docker and Kubernetes."""
    return JSONResponse({"status": "ok", "service": "video-moderator"})


@app.get("/ready")
async def ready() -> JSONResponse:
    """Readiness probe — reports whether the consumer is running."""
    running = _consumer_task is not None and not _consumer_task.done()
    status_code = 200 if running else 503
    return JSONResponse(
        {"status": "ready" if running else "not_ready"},
        status_code=status_code,
    )


if __name__ == "__main__":
    settings = get_settings()
    logging.basicConfig(level=settings.log_level)
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        log_level=settings.log_level.lower(),
    )
