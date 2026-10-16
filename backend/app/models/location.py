import uuid
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    Float,
    ForeignKey,
    Index,
    SmallInteger,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )


class City(Base):
    __tablename__ = "cities"

    id: Mapped[uuid.UUID] = _uuid_pk()
    slug: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text, unique=True)
    region: Mapped[str | None] = mapped_column(Text)


class University(Base):
    __tablename__ = "universities"

    id: Mapped[uuid.UUID] = _uuid_pk()
    slug: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)
    short_name: Mapped[str] = mapped_column(Text)
    city_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cities.id", ondelete="CASCADE")
    )


class Campus(Base):
    __tablename__ = "campuses"

    id: Mapped[uuid.UUID] = _uuid_pk()
    slug: Mapped[str] = mapped_column(Text, unique=True)
    university_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("universities.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(Text)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)


class Department(Base):
    __tablename__ = "departments"
    __table_args__ = (UniqueConstraint("campus_id", "name"),)

    id: Mapped[uuid.UUID] = _uuid_pk()
    university_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("universities.id", ondelete="CASCADE")
    )
    campus_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campuses.id", ondelete="CASCADE")
    )
    name: Mapped[str] = mapped_column(Text)


class Neighborhood(Base):
    __tablename__ = "neighborhoods"

    id: Mapped[uuid.UUID] = _uuid_pk()
    city_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cities.id", ondelete="CASCADE")
    )
    slug: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)
    name_el: Mapped[str] = mapped_column(Text)
    zone: Mapped[str] = mapped_column(Text)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    description: Mapped[str] = mapped_column(Text)
    typical_studio_rent: Mapped[int] = mapped_column(SmallInteger)
    # 1–5, higher is better for the student.
    safety: Mapped[int] = mapped_column(SmallInteger)
    quiet: Mapped[int] = mapped_column(SmallInteger)
    nightlife: Mapped[int] = mapped_column(SmallInteger)
    green: Mapped[int] = mapped_column(SmallInteger)
    amenities: Mapped[int] = mapped_column(SmallInteger)
    student_life: Mapped[int] = mapped_column(SmallInteger)
    # [{"text": "...", "factor": "safety" | "rent" | ... | null}]
    pros: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb")
    )
    cons: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb")
    )
    sources: Mapped[list[str]] = mapped_column(
        JSONB, server_default=text("'[]'::jsonb")
    )


class TransitHub(Base):
    __tablename__ = "transit_hubs"
    __table_args__ = (
        CheckConstraint("kind in ('ktel', 'airport', 'port', 'rail')", name="kind"),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    city_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cities.id", ondelete="CASCADE")
    )
    slug: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(Text)
    serves: Mapped[str] = mapped_column(Text)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)


class TravelTime(Base):
    """Transit time from a neighborhood to either a campus or a hub."""

    __tablename__ = "travel_times"
    __table_args__ = (
        CheckConstraint(
            "(campus_id is null) <> (hub_id is null)", name="one_destination"
        ),
        CheckConstraint("source in ('estimate', 'google')", name="source"),
        Index(
            "travel_times_neighborhood_campus_key",
            "neighborhood_id",
            "campus_id",
            unique=True,
            postgresql_where=text("campus_id is not null"),
        ),
        Index(
            "travel_times_neighborhood_hub_key",
            "neighborhood_id",
            "hub_id",
            unique=True,
            postgresql_where=text("hub_id is not null"),
        ),
    )

    id: Mapped[uuid.UUID] = _uuid_pk()
    neighborhood_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("neighborhoods.id", ondelete="CASCADE")
    )
    campus_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("campuses.id", ondelete="CASCADE")
    )
    hub_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transit_hubs.id", ondelete="CASCADE")
    )
    transit_minutes: Mapped[int] = mapped_column(SmallInteger)
    route_summary: Mapped[str | None] = mapped_column(Text)
    # "estimate" = straight-line distance heuristic (seed.py); "google" = Routes API.
    source: Mapped[str] = mapped_column(Text, server_default="estimate")
