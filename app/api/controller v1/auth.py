from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.user import UserRegister, UserLogin
from app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register")
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Enregistrer un nouvel utilisateur"""
    result = UserService.register_user(
     
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        email=user_data.email,
        phone=user_data.phone,
        password=user_data.password
    )
    return result


@router.post("/login")
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Connecter un utilisateur"""
    result = UserService.login_user(
        db=db,
        email=credentials.email,
        password=credentials.password
    )
    return result


@router.get("/user/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Récupérer les informations d'un utilisateur"""
    result = UserService.get_user_by_id(db=db, user_id=user_id)
    return result
