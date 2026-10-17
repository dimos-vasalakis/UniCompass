import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError, InterfaceError, OperationalError

from app.api.v1.router import api_router
from app.core.config import get_settings, is_unset
from app.core.db import get_engine

settings = get_settings()
logger = logging.getLogger("uvicorn.error")

if not is_unset(settings.sentry_dsn):
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        traces_sample_rate=1.0 if settings.environment == "development" else 0.1,
        enable_logs=True,
    )


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if is_unset(settings.database_url):
        logger.warning(
            "DATABASE_URL is not set (still the .env.example placeholder). "
            "Endpoints that need the database will return 503."
        )
    yield
    if not is_unset(settings.database_url):
        await get_engine().dispose()


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.exception_handler(OperationalError)
@app.exception_handler(InterfaceError)
async def database_unavailable(_: Request, exc: DBAPIError) -> JSONResponse:
    # Can't reach Postgres (bad DATABASE_URL, Supabase paused, network). Return a
    # clear 503 instead of a bare 500; handled here so CORS headers are kept.
    logger.error("Database unavailable: %s", exc.orig)
    return JSONResponse(status_code=503, content={"detail": "Database unavailable"})
