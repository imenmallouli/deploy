from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    
    first_name: str
    last_name: str
    email: EmailStr
    phone: str
    password: str


class UserLogin(BaseModel):
    
    email: EmailStr
    password: str


class UserResponse(BaseModel):
  
    user_id: int
    email: str
    
