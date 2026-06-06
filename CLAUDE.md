# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RescateYa is a vehicle emergency assistance platform. A driver reports a breakdown via Flutter mobile app → the backend uses AI (OpenAI Whisper + GPT-4 Vision + Google Gemini/Vertex AI) to classify it → nearby workshops receive the case on the Angular web panel → workshops submit offers → the client compares and accepts one → a technician is dispatched → service is completed → client pays (simulated) → client reviews the workshop.

**Monorepo:** `backend/` (FastAPI) + `frontend/` (Angular 21) + `mobile/` (Flutter)

## Role → Platform Mapping

| Role | Platform |
|------|----------|
| Client / Driver | Flutter mobile only |
| Technician | Flutter mobile only |
| Workshop admin | Angular web only |
| Platform admin (RescateYa) | Angular web only |

Do not build web views for clients or technicians as a primary flow. Do not build mobile views for workshop/platform admin.

---

## Backend

### Python version

The system has two Python installations. **Always use Python 3.13** — the venv was created with it:

```bash
# Create venv (first time only)
cd backend
py -3.13 -m venv venv

# Activate (every new terminal session)
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

pip install -r requirements.txt
```

### Run

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
# Swagger UI → http://localhost:8000/docs
```

### Database

PostgreSQL 16 required. The target database is `emergencias_vehiculares` (configured in `backend/.env` → `DATABASE_URL`).

```bash
# Create DB if it doesn't exist
psql -U postgres -c "CREATE DATABASE emergencias_vehiculares;"

# Schema is managed by Alembic (NOT create_all anymore). Apply migrations:
venv\Scripts\activate
alembic upgrade head

# Seed demo data (required before first login)
python seed.py
# All demo users share password: 12345678*
```

**Migrations (Alembic):** config in `backend/alembic.ini` + `backend/alembic/`.
`env.py` reads `DATABASE_URL` from settings and uses `app.models` metadata for
autogenerate. Create a new migration with
`alembic revision --autogenerate -m "msg"` then `alembic upgrade head`.
Multitenancy = each Workshop is a Tenant (1:1); tenant-scoped tables carry
`tenant_id` (users/workshops/technicians/service_offers/incidents).

### Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Platform admin | admin@rescateya.bo | 12345678* |
| Workshop | contacto@elpiston.com | 12345678* |
| Client | carlos.mendez@email.com | 12345678* |
| Technician | luis.roca@elpiston.com | 12345678* |

### Auth endpoint

```
POST /api/auth/login          ← note the /api prefix
POST /api/auth/register
GET  /api/auth/me
```

All routers use `/api/` prefix. Check `app/main.py` router registrations for the full list.

### Architecture

```
app/
  main.py          # FastAPI app, CORS, static /uploads mount, router registration, /ws WebSocket
  config.py        # Settings from backend/.env via pydantic-settings
  database.py      # SQLAlchemy engine + SessionLocal + get_db dependency
  models/          # ORM models: User, Vehicle, Workshop, Technician, Incident, Evidence,
                   #             Offer, Assignment, Chat, Payment, Review, Notification, StatusHistory
  schemas/         # Pydantic request/response schemas (mirrors models/)
  routers/         # FastAPI routers — one per domain (auth, users, vehicles, workshops,
                   #                  technician, incidents, assignment, payments,
                   #                  notifications, chat, reviews)
  services/
    ai_processor.py       # Orchestrates the AI pipeline for an incident
    assignment_engine.py  # Offer scoring and auto-assignment logic
    notification_service.py
    push_service.py       # Firebase FCM (gracefully disabled if credentials missing)
    websocket_manager.py  # In-memory WebSocket connection registry
  ai/
    audio_transcriber.py  # OpenAI Whisper → text, then GPT-4o-mini extracts key fields
    image_analyzer.py     # GPT-4 Vision describes uploaded images
    gemini_client.py      # Google Vertex AI (gemini-1.5-flash) for JSON classification
    incident_classifier.py
  utils/
    security.py           # JWT creation/verification, bcrypt hashing, get_current_user dep
uploads/             # Runtime dir for user-uploaded images and audio
seed.py              # Creates demo users, workshops, technicians, vehicles, incidents
```

### Key rules

- Passwords must always be stored hashed via `utils/security.hash_password`.
- Role enforcement must live in backend, not only hidden in frontend.
- Workshops submit offers; they do **not** directly assign themselves to an incident.
- The accepted offer price is final — workshops cannot change the amount after acceptance.
- Payment is initiated by the client from mobile (simulated card last-4-digits or cash). That payment marks the incident as completed.
- Store only last 4 digits of card; no full card numbers anywhere.
- `OPENAI_API_KEY` empty → audio transcription and image analysis will raise errors at runtime (not at startup).
- `FIREBASE_CREDENTIALS_PATH` missing → push notifications silently disabled (logged as warning).
- Gemini uses Vertex AI (`vertexai=True`) → requires `gcloud auth application-default login` to work locally.

---

## Frontend (Angular 21)

```bash
cd frontend
npm install        # first time
npm start          # http://localhost:4200
npm run build      # production build → dist/
```

Standalone components throughout (no NgModules). API base URL is in `src/environments/environment.ts` (`apiUrl`). Route guards in `src/app/guards/` enforce `admin` and `workshop` roles only.

---

## Mobile (Flutter)

```bash
cd mobile
flutter pub get    # first time
# Set backend URL in lib/services/api_service.dart → baseUrl
flutter run        # prompts for device/emulator
flutter build apk  # Android release
```

State management: **BLoC** (`flutter_bloc`) for auth and theme; **Provider** for lighter state. Firebase `google-services.json` (Android) or `GoogleService-Info.plist` (iOS) must be placed in the platform directory for push notifications.

---

## Ports

| Service | Port |
|---------|------|
| Backend | 8000 |
| Frontend | 4200 |
| PostgreSQL | 5432 |

## No tests yet

No test suite exists for backend or mobile. Angular CLI test tooling is configured but no test files are written.
