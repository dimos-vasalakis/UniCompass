from math import asin, cos, radians, sin, sqrt


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    dlat, dlng = radians(lat2 - lat1), radians(lng2 - lng1)
    a = (
        sin(dlat / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    )
    return 2 * 6371 * asin(sqrt(a))


def estimate_transit_minutes(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    """Rough door-to-door public transport time for Athens.

    ~12 min of walking/waiting plus ~3 min per straight-line km (streets aren't
    straight and buses aren't fast). Replaced by real Routes API data once
    scripts/compute_travel_times.py has run.
    """
    return round(12 + 3.1 * haversine_km(lat1, lng1, lat2, lng2))


WALK_M_PER_MIN = 80
STREET_FACTOR = 1.3  # streets aren't straight lines
WALKABLE_KM = 1.5


def walk_minutes(distance_m: float) -> int:
    return max(1, round(distance_m * STREET_FACTOR / WALK_M_PER_MIN))
