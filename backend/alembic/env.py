from logging.config import fileConfig

from sqlalchemy import create_engine, pool

from alembic import context
from app.core.config import get_settings, is_unset, sqlalchemy_url
from app.models import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Migrations use the direct connection, never the transaction pooler.
if is_unset(get_settings().direct_url):
    raise SystemExit(
        "DIRECT_URL in backend/.env is not set (still the <placeholder> from "
        ".env.example). Copy it from Supabase → Connect. See README → Database."
    )
url = sqlalchemy_url(get_settings().direct_url)


def include_object(obj, name, type_, reflected, compare_to):
    # Only manage our own schema; auth/storage/etc. belong to Supabase.
    schema = getattr(obj, "schema", None) or getattr(
        getattr(obj, "table", None), "schema", None
    )
    return schema in (None, "public")


def run_migrations_offline() -> None:
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(url, poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_object=include_object,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
