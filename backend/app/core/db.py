from collections.abc import AsyncIterator
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings, is_unset, sqlalchemy_url


@lru_cache
def get_engine() -> AsyncEngine:
    return create_async_engine(
        sqlalchemy_url(get_settings().database_url),
        pool_pre_ping=True,
        # Supavisor's transaction pooler doesn't support prepared statements.
        connect_args={"prepare_threshold": None},
    )


@lru_cache
def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(bind=get_engine(), expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    if is_unset(get_settings().database_url):
        raise HTTPException(503, "Database unavailable: DATABASE_URL is not configured")
    async with get_sessionmaker()() as session:
        yield session


DbSession = Annotated[AsyncSession, Depends(get_db)]
