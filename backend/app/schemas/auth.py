from pydantic import BaseModel


class LoginJSON(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    id: int
    username: str
    rol: str

    model_config = {"from_attributes": True}
