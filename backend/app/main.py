from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine, get_db
from app.routers import assignment, auth, chat, incidents, notifications, offers, payments, reviews, technician, users, vehicles, workshops
from app.services.websocket_manager import manager
from app.utils.security import get_current_user_from_token

# Crear tablas
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Plataforma de Emergencias Vehiculares",
    description="API para la gestion inteligente de emergencias vehiculares",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Servir archivos subidos
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Registrar routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(vehicles.router)
app.include_router(workshops.router)
app.include_router(technician.router)
app.include_router(incidents.router)
app.include_router(assignment.router)
app.include_router(offers.router)
app.include_router(payments.router)
app.include_router(notifications.router)
app.include_router(chat.router)
app.include_router(reviews.router)


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Plataforma Inteligente de Emergencias Vehiculares",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["Root"])
def health_check():
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """WebSocket endpoint for real-time notifications."""
    db = next(get_db())
    try:
        user = get_current_user_from_token(token, db)
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return
    finally:
        db.close()

    await manager.connect(websocket, user.id)
    try:
        while True:
            # Keep connection alive; client can send pings
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, user.id)
