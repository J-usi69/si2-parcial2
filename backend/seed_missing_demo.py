"""Crea (sin borrar nada existente) los 3 usuarios demo que falten para poder
probar los 3 roles restantes de la plataforma: taller, tecnico y cliente.

A diferencia de seed.py, este script NO llama a clear_database() -- usa las
mismas funciones get_or_create_* (idempotentes) para no tocar datos ya
existentes en la base. Seguro de correr mas de una vez.

Uso (dentro del contenedor backend):
    python seed_missing_demo.py
"""
from app.database import SessionLocal
from app.models import UserRole
from seed import (
    get_or_create_tenant,
    get_or_create_technician,
    get_or_create_user,
    get_or_create_workshop,
)


def run() -> None:
    db = SessionLocal()
    try:
        get_or_create_user(db, "luciana.mendez@gmail.com", "Luciana Mendez", "70000002", UserRole.CLIENT)

        tenant = get_or_create_tenant(db, "Taller San Lorenzo Motor", "taller-1", "71010001")
        workshop_user = get_or_create_user(
            db, "contacto@tallersanlorenzo.bo", "Taller San Lorenzo Motor", "71010001",
            UserRole.WORKSHOP, tenant_id=tenant.id,
        )
        workshop = get_or_create_workshop(
            db, workshop_user, tenant.id,
            "Taller San Lorenzo Motor",
            "Av. El Trompillo 320, entre 2do y 3er anillo, Santa Cruz",
            -17.7855, -63.1798,
            "71010001",
            "battery,engine,keys,other",
            8, 4.8, 134,
            "Especialistas en motor, bateria y diagnostico electronico en zona El Trompillo.",
        )

        tech_user = get_or_create_user(
            db, "wilber.gutierrez@tallersanlorenzo.bo", "Wilber Gutierrez", "71110001",
            UserRole.TECHNICIAN, tenant_id=tenant.id,
        )
        get_or_create_technician(
            db, workshop, tech_user, "Wilber Gutierrez", "71110001",
            "battery,engine", -17.7880, -63.1805,
        )

        db.commit()
        print("OK: cliente, taller y tecnico demo listos.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
