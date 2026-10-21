from fastapi import APIRouter

from app.api.v1.endpoints import assistant, billing, health, match, places, users

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(users.router)
api_router.include_router(billing.router)
api_router.include_router(places.router)
api_router.include_router(match.router)
api_router.include_router(assistant.router)
