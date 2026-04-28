from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.workshop import Technician, Workshop
from app.schemas.workshop import (
    TechnicianCreate,
    TechnicianResponse,
    TechnicianUpdate,
    WorkshopCreate,
    WorkshopResponse,
    WorkshopUpdate,
)
from app.utils.security import get_current_user, hash_password

router = APIRouter(prefix="/api/workshops", tags=["Talleres"])


@router.get("/", response_model=list[WorkshopResponse])
def list_workshops(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Solo administradores pueden ver talleres")

    return db.query(Workshop).order_by(Workshop.created_at.desc()).all()


@router.post("/", response_model=WorkshopResponse, status_code=status.HTTP_201_CREATED)
def create_workshop(
    data: WorkshopCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.WORKSHOP:
        raise HTTPException(status_code=403, detail="Solo usuarios tipo taller pueden crear talleres")

    existing = db.query(Workshop).filter(Workshop.user_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya tiene un taller registrado")

    workshop = Workshop(user_id=current_user.id, **data.model_dump())
    db.add(workshop)
    db.commit()
    db.refresh(workshop)
    return workshop


@router.get("/me", response_model=WorkshopResponse)
def get_my_workshop(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workshop = db.query(Workshop).filter(Workshop.user_id == current_user.id).first()
    if not workshop:
        # Auto-crear taller para usuarios workshop existentes
        if current_user.role == UserRole.WORKSHOP:
            workshop = Workshop(
                user_id=current_user.id,
                name=f"Taller de {current_user.full_name}",
                address="Direccion pendiente",
                latitude=0.0,
                longitude=0.0,
                phone=current_user.phone,
            )
            db.add(workshop)
            db.commit()
            db.refresh(workshop)
            return workshop
        raise HTTPException(status_code=404, detail="No tiene taller registrado")
    return workshop


@router.put("/me", response_model=WorkshopResponse)
def update_my_workshop(
    data: WorkshopUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    workshop = db.query(Workshop).filter(Workshop.user_id == current_user.id).first()
    if not workshop:
        raise HTTPException(status_code=404, detail="No tiene taller registrado")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(workshop, field, value)
    db.commit()
    db.refresh(workshop)
    return workshop


@router.get("/nearby", response_model=list[WorkshopResponse])
def get_nearby_workshops(
    latitude: float,
    longitude: float,
    radius_km: float = 10.0,
    db: Session = Depends(get_db),
):
    workshops = db.query(Workshop).filter(Workshop.is_available == True).all()
    from geopy.distance import geodesic
    nearby = []
    for w in workshops:
        dist = geodesic((latitude, longitude), (w.latitude, w.longitude)).km
        if dist <= radius_km:
            nearby.append(w)
    nearby.sort(key=lambda w: geodesic((latitude, longitude), (w.latitude, w.longitude)).km)
    return nearby


# --- Tecnicos ---

@router.post("/technicians", response_model=TechnicianResponse, status_code=status.HTTP_201_CREATED)
def create_technician(
    data: TechnicianCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.WORKSHOP:
        raise HTTPException(status_code=403, detail="Solo usuarios tipo taller pueden gestionar tecnicos")

    workshop = db.query(Workshop).filter(Workshop.user_id == current_user.id).first()
    if not workshop:
        raise HTTPException(status_code=404, detail="No tiene taller registrado")

    payload = data.model_dump(exclude={"email", "password"})
    technician_user = None
    if data.email:
        existing_user = db.query(User).filter(User.email == data.email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Ya existe un usuario con ese correo")
        technician_user = User(
            email=data.email,
            password_hash=hash_password(data.password or "12345678*"),
            full_name=data.name,
            phone=data.phone,
            role=UserRole.TECHNICIAN,
        )
        db.add(technician_user)
        db.flush()

    technician = Technician(
        workshop_id=workshop.id,
        user_id=technician_user.id if technician_user else None,
        **payload,
    )
    db.add(technician)
    db.commit()
    db.refresh(technician)
    return technician


@router.get("/technicians", response_model=list[TechnicianResponse])
def list_technicians(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.WORKSHOP:
        raise HTTPException(status_code=403, detail="Solo usuarios tipo taller pueden ver tecnicos")

    workshop = db.query(Workshop).filter(Workshop.user_id == current_user.id).first()
    if not workshop:
        raise HTTPException(status_code=404, detail="No tiene taller registrado")
    return db.query(Technician).filter(Technician.workshop_id == workshop.id).all()


@router.put("/technicians/{technician_id}", response_model=TechnicianResponse)
def update_technician(
    technician_id: int,
    data: TechnicianUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.WORKSHOP:
        raise HTTPException(status_code=403, detail="Solo usuarios tipo taller pueden gestionar tecnicos")

    workshop = db.query(Workshop).filter(Workshop.user_id == current_user.id).first()
    if not workshop:
        raise HTTPException(status_code=404, detail="No tiene taller registrado")

    technician = db.query(Technician).filter(
        Technician.id == technician_id, Technician.workshop_id == workshop.id
    ).first()
    if not technician:
        raise HTTPException(status_code=404, detail="Tecnico no encontrado")

    payload = data.model_dump(exclude_unset=True, exclude={"email", "password"})
    for field, value in payload.items():
        setattr(technician, field, value)

    if technician.user:
        if data.name is not None:
            technician.user.full_name = data.name
        if data.phone is not None:
            technician.user.phone = data.phone
        if data.email is not None and data.email != technician.user.email:
            existing_user = db.query(User).filter(User.email == data.email, User.id != technician.user.id).first()
            if existing_user:
                raise HTTPException(status_code=400, detail="Ya existe un usuario con ese correo")
            technician.user.email = data.email
        if data.password:
            if len(data.password) < 8:
                raise HTTPException(status_code=400, detail="La contrasena debe tener al menos 8 caracteres")
            technician.user.password_hash = hash_password(data.password)
    elif data.email:
        existing_user = db.query(User).filter(User.email == data.email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Ya existe un usuario con ese correo")
        technician_user = User(
            email=data.email,
            password_hash=hash_password(data.password or "12345678*"),
            full_name=data.name or technician.name,
            phone=data.phone or technician.phone,
            role=UserRole.TECHNICIAN,
        )
        db.add(technician_user)
        db.flush()
        technician.user_id = technician_user.id
    db.commit()
    db.refresh(technician)
    return technician


@router.delete("/technicians/{technician_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_technician(
    technician_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.WORKSHOP:
        raise HTTPException(status_code=403, detail="Solo usuarios tipo taller pueden gestionar tecnicos")

    workshop = db.query(Workshop).filter(Workshop.user_id == current_user.id).first()
    if not workshop:
        raise HTTPException(status_code=404, detail="No tiene taller registrado")

    technician = db.query(Technician).filter(
        Technician.id == technician_id, Technician.workshop_id == workshop.id
    ).first()
    if not technician:
        raise HTTPException(status_code=404, detail="Tecnico no encontrado")
    db.delete(technician)
    db.commit()
