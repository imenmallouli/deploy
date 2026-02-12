from sqlalchemy.orm import Session
from passlib.context import CryptContext
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserService:

    @staticmethod
    def hash_password(password: str) -> str:
      
        return pwd_context.hash(password)

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def register_user(db: Session, first_name: str, last_name: str, 
                     email: str, phone: str, password: str):
      
        existing_user = db.query(User).filter(User.email == email).first()
        
        if existing_user:
            return {"status": "error", "message": "Email déjà existant"}
        
        new_user = User(
            first_name=first_name,
            last_name=last_name,
            email=email,
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
            "email": new_user.email
        }

    @staticmethod
    def login_user(db: Session, email: str, password: str):
        """Connecte un utilisateur (vérifie les identifiants)"""
        
       
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            return {"status": "error", "message": "Utilisateur non trouvé"}
        
       
        if not UserService.verify_password(password, user.password_hash):
            return {"status": "error", "message": "Mot de passe incorrect"}
        
        return {
            "status": "success",
            "message": "Connexion réussie",
            "user_id": user.id,
            "email": user.email,
            "first_name": user.first_name
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
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone
        }
