from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.user import UserRegister, UserLogin
from app.services.user_service import UserService

router = APIRouter(prefix="/auth", tags=["Authentication"])
security = HTTPBearer()


def get_current_payload(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        payload = UserService.decode_access_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc)
        ) from exc

    return payload


@router.post("/register")
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Enregistrer un nouvel utilisateur"""
    result = UserService.register_user(
        db=db,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        email=user_data.email,
        phone=user_data.phone,
        password=user_data.password
    )
    return result


@router.post("/login")
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    
    result = UserService.login_user(
        db=db,
        email=credentials.email,
        password=credentials.password
    )
    return result


@router.get("/user/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    result = UserService.get_user_by_id(db=db, user_id=user_id)
    return result


@router.get("/me")
def get_me(
    payload: dict = Depends(get_current_payload),
    db: Session = Depends(get_db)
):
    user_id = payload.get("user_id")

    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide"
        )

    result = UserService.get_user_by_id(db=db, user_id=user_id)

    if result.get("status") == "error":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )

    return result
