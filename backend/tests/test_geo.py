import pytest

from app.services.geo import estimate_transit_minutes, haversine_km, walk_minutes

SYNTAGMA = (37.9755, 23.7348)
PIRAEUS_PORT = (37.9420, 23.6460)


def test_haversine_known_distance() -> None:
    # Syntagma → Piraeus port is ~8.5 km as the crow flies.
    assert haversine_km(*SYNTAGMA, *PIRAEUS_PORT) == pytest.approx(8.5, abs=0.3)


def test_haversine_is_symmetric_and_zero_on_self() -> None:
    assert haversine_km(*SYNTAGMA, *SYNTAGMA) == 0
    assert haversine_km(*SYNTAGMA, *PIRAEUS_PORT) == pytest.approx(
        haversine_km(*PIRAEUS_PORT, *SYNTAGMA)
    )


def test_estimate_has_a_floor_and_grows_with_distance() -> None:
    assert estimate_transit_minutes(*SYNTAGMA, *SYNTAGMA) == 12
    near = estimate_transit_minutes(*SYNTAGMA, 37.98, 23.74)
    far = estimate_transit_minutes(*SYNTAGMA, *PIRAEUS_PORT)
    assert 12 <= near < far


def test_walk_minutes() -> None:
    assert walk_minutes(0) == 1  # never "0 min"
    assert walk_minutes(600) == 10  # 600 m * 1.3 detour / 80 m/min
    assert walk_minutes(1200) > walk_minutes(600)
