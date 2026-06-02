from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.workshop import Workshop
from app.schemas.user import Token, UserCreate, UserLogin, UserResponse
from app.utils.security import create_access_token, get_current_user, hash_password, verify_password
from app.utils.tenancy import create_tenant_for_workshop

router = APIRouter(prefix="/api/auth", tags=["Autenticacion"])


def _token_for(user: User) -> str:
    """JWT con sub + tenant_id (refuerza el aislamiento multitenant)."""
    return create_access_token({"sub": str(user.id), "tenant_id": user.tenant_id})


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="El email ya esta registrado")

    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name,
        phone=user_data.phone,
        role=user_data.role,
    )
    db.add(user)
    db.flush()

    # Un taller = un tenant: al registrar un WORKSHOP se crea su Tenant 1:1.
    if user.role == UserRole.WORKSHOP:
        tenant = create_tenant_for_workshop(db, name=f"Taller de {user.full_name}", contact_phone=user.phone)
        user.tenant_id = tenant.id
        workshop = Workshop(
            tenant_id=tenant.id,
            user_id=user.id,
            name=f"Taller de {user.full_name}",
            address="Direccion pendiente",
            latitude=0.0,
            longitude=0.0,
            phone=user.phone,
        )
        db.add(workshop)

    db.commit()
    db.refresh(user)

    token = _token_for(user)
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=Token)
def login(credentials: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    token = _token_for(user)
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
