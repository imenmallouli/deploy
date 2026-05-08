import os
from datetime import datetime, timedelta, timezone

import jwt
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-secret-key")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))


class UserService:

    @staticmethod
    def normalize_role(role: str | None, default: str = "user") -> str:
        normalized_role = (role or default).strip().lower()
        if normalized_role not in {"user", "admin"}:
            return default
        return normalized_role

    @staticmethod
    def create_access_token(email: str, user_id: int, role: str) -> str:
        normalized_role = UserService.normalize_role(role)
        now = datetime.now(timezone.utc)
        payload = {
            "sub": email,
            "user_id": user_id,
            "role": normalized_role,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(minutes=JWT_EXPIRE_MINUTES)).timestamp())
        }
        return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

    @staticmethod
    def decode_access_token(token: str) -> dict:
        try:
            if token.lower().startswith("bearer "):
                token = token.split(" ", 1)[1].strip()
            return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError as exc:
            raise ValueError("Token expiré") from exc
        except jwt.InvalidTokenError as exc:
            raise ValueError("Token invalide") from exc

    @staticmethod
    def hash_password(password: str) -> str:
      
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def register_user(db: Session, first_name: str, last_name: str, 
                     email: str, role: str, phone: str, password: str):
        normalized_role = UserService.normalize_role(role)
        if normalized_role not in {"user", "admin"}:
            return {"status": "error", "message": "Role non autorise"}

      
        existing_user = db.query(User).filter(User.email == email).first()
        
        if existing_user:
            return {"status": "error", "message": "Email déjà existant"}
        
        new_user = User(
            first_name=first_name,
            last_name=last_name,
            email=email,
            role=normalized_role,
            phone=phone,
            password_hash=UserService.hash_password(password)
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        return {
            "status": "success",
            "message": "Utilisateur créé avec succès",
            "user_id": new_user.id,
            "email": new_user.email,
            "role": normalized_role,
            "access_token": UserService.create_access_token(new_user.email, new_user.id, new_user.role),
            "token_type": "bearer",
            "expires_in_minutes": JWT_EXPIRE_MINUTES
        }

    @staticmethod
    def login_user(db: Session, email: str, password: str):
        """Connecte un utilisateur (vérifie les identifiants)"""
        
       
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            return {"status": "error", "message": "Utilisateur non trouvé"}
        
       
        if not UserService.verify_password(password, user.password_hash):
            return {"status": "error", "message": "Mot de passe incorrect"}

        normalized_role = UserService.normalize_role(user.role)

        return {
            "status": "success",
            "message": "Connexion réussie",
            "user_id": user.id,
            "email": user.email,
            "role": normalized_role,
            "first_name": user.first_name,
            "access_token": UserService.create_access_token(user.email, user.id, user.role),
            "token_type": "bearer",
            "expires_in_minutes": JWT_EXPIRE_MINUTES
        }

    @staticmethod
    def list_users(db: Session):
        users = db.query(User).order_by(User.id.asc()).all()
        return {
            "status": "success",
            "items": [
                {
                    "user_id": user.id,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "email": user.email,
                    "role": UserService.normalize_role(user.role),
                    "phone": user.phone,
                }
                for user in users
            ],
            "count": len(users),
        }

    @staticmethod
    def create_user_by_admin(db: Session, first_name: str, last_name: str,
                             email: str, role: str, phone: str, password: str):
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            return {"status": "error", "message": "Email déjà existant"}

        # For admin-managed creation endpoint, always provision admin accounts.
        enforced_role = "admin"

        new_user = User(
            first_name=first_name,
            last_name=last_name,
            email=email,
            role=enforced_role,
            phone=phone,
            password_hash=UserService.hash_password(password)
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return {
            "status": "success",
            "message": "Utilisateur créé avec succès",
            "user_id": new_user.id,
            "email": new_user.email,
            "role": UserService.normalize_role(new_user.role),
        }

    @staticmethod
    def set_user_role(db: Session, user_id: int, role: str):
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"status": "error", "message": "Utilisateur non trouvé"}

        user.role = UserService.normalize_role(role)
        db.commit()
        db.refresh(user)
        return {
            "status": "success",
            "message": "Role mis a jour",
            "user_id": user.id,
            "role": user.role,
        }

    @staticmethod
    def reset_password_by_admin(db: Session, user_id: int, new_password: str):
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"status": "error", "message": "Utilisateur non trouvé"}

        user.password_hash = UserService.hash_password(new_password)
        db.commit()
        return {
            "status": "success",
            "message": "Mot de passe reinitialise",
            "user_id": user.id,
        }

    @staticmethod
    def delete_user_by_admin(db: Session, user_id: int, requester_user_id: int | None = None):
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"status": "error", "message": "Utilisateur non trouvé"}

        if requester_user_id is not None and user.id == requester_user_id:
            return {"status": "error", "message": "Suppression de votre propre compte interdite"}

        db.delete(user)
        db.commit()
        return {
            "status": "success",
            "message": "Utilisateur supprime",
            "user_id": user_id,
        }

    @staticmethod
    def forgot_password(db: Session, email: str):
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return {
                "status": "success",
                "message": "Si ce compte existe, un email de reinitialisation sera envoye"
            }

        return {
            "status": "success",
            "message": "Si ce compte existe, un email de reinitialisation sera envoye",
            "email": user.email,
        }

    @staticmethod
    def get_user_by_id(db: Session, user_id: int):

        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            return {"status": "error", "message": "Utilisateur non trouvé"}
        
        return {
            "status": "success",
            "user_id": user.id,
            "email": user.email,
            "role": UserService.normalize_role(user.role),
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone
        }
