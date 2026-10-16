import uuid
from typing import Literal

from pydantic import BaseModel, ConfigDict


class Profile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str | None = None
    role: Literal["high_school", "university"] = "high_school"
    is_premium: bool = False


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    role: Literal["high_school", "university"] | None = None
