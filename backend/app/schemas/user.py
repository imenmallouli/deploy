from pydantic import BaseModel, EmailStr


class UserRegister(BaseModel):
    
    first_name: str
    last_name: str
    email: EmailStr
    role: str = "user"
    phone: str
    password: str


class UserLogin(BaseModel):
    
    email: EmailStr
    password: str


class UserForgotPassword(BaseModel):
    email: EmailStr


class UserResetPassword(BaseModel):
    token: str
    new_password: str


class UserResetByAdmin(BaseModel):
    new_password: str


class UserRoleUpdate(BaseModel):
    role: str


class UserResponse(BaseModel):
  
    user_id: int
    email: str
    
