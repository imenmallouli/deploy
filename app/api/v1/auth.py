from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.user import UserForgotPassword, UserLogin, UserRegister, UserResetByAdmin, UserResetPassword, UserRoleUpdate
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


def require_admin(payload: dict = Depends(get_current_payload)):
    role = UserService.normalize_role(payload.get("role"), default="user")
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acces reserve a l'admin"
        )
    return payload


@router.post("/register")
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    """Enregistrer un nouvel utilisateur"""
    result = UserService.register_user(
        db=db,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        email=user_data.email,
        role=user_data.role,
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


@router.get("/users")
def list_users(
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return UserService.list_users(db=db)


@router.post("/create-user")
def create_user_by_admin(
    user_data: UserRegister,
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return UserService.create_user_by_admin(
        db=db,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        email=user_data.email,
        role=user_data.role,
        phone=user_data.phone,
        password=user_data.password,
    )


@router.post("/role/{user_id}")
def set_role_by_admin(
    user_id: int,
    payload: UserRoleUpdate,
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return UserService.set_user_role(db=db, user_id=user_id, role=payload.role)


@router.post("/reset-password/{user_id}")
def reset_password_by_admin(
    user_id: int,
    payload: UserResetByAdmin,
    _: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    return UserService.reset_password_by_admin(db=db, user_id=user_id, new_password=payload.new_password)


@router.delete("/user/{user_id}")
def delete_user_by_admin(
    user_id: int,
    admin_payload: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    requester_user_id = admin_payload.get("user_id")
    return UserService.delete_user_by_admin(
        db=db,
        user_id=user_id,
        requester_user_id=requester_user_id,
    )


@router.post("/impersonate/{user_id}")
def impersonate_user_by_admin(
    user_id: int,
    admin_payload: dict = Depends(require_admin),
    db: Session = Depends(get_db)
):
    requester_user_id = admin_payload.get("user_id")
    return UserService.impersonate_user_by_admin(
        db=db,
        target_user_id=user_id,
        admin_user_id=requester_user_id,
    )


@router.post("/forgot-password")
def forgot_password(
    payload: UserForgotPassword,
    db: Session = Depends(get_db)
):
    return UserService.forgot_password(db=db, email=payload.email)


@router.post("/reset-password")
def reset_password(payload: UserResetPassword, db: Session = Depends(get_db)):
    result = UserService.reset_password_with_token(
        db=db,
        token=payload.token,
        new_password=payload.new_password,
    )

    if result.get("status") != "success":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.get("message") or "Reinitialisation impossible",
        )

    return result
