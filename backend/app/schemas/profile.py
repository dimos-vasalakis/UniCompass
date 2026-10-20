import uuid
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, StringConstraints

Username = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_.-]{3,20}$")]


class Profile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str | None = None
    username: str | None = None
    role: Literal["high_school", "university"] = "high_school"
    is_premium: bool = False


class ProfileUpdate(BaseModel):
    full_name: str | None = None
    username: Username | None = None
    role: Literal["high_school", "university"] | None = None
