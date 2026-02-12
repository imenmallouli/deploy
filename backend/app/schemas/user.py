from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    """Schema pour s'enregistrer"""
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    password: str


class UserLogin(BaseModel):
    """Schema pour se connecter"""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Schema pour la réponse utilisateur"""
    user_id: int
    email: str
    
