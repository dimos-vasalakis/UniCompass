from pydantic import BaseModel


class CheckoutResponse(BaseModel):
    url: str
