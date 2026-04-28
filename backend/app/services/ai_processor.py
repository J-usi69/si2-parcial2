import os
import threading

from sqlalchemy.orm import Session

from app.ai.audio_transcriber import extract_key_info, transcribe_audio
from app.ai.image_analyzer import analyze_vehicle_image
from app.ai.incident_classifier import classify_incident
from app.config import settings
from app.database import SessionLocal
from app.models.evidence import Evidence, EvidenceType
from app.models.incident import Incident, IncidentCategory, IncidentPriority


PRIORITY_MAP = {
    "low": IncidentPriority.LOW,
    "medium": IncidentPriority.MEDIUM,
    "high": IncidentPriority.HIGH,
    "critical": IncidentPriority.CRITICAL,
    "baja": IncidentPriority.LOW,
    "media": IncidentPriority.MEDIUM,
    "alta": IncidentPriority.HIGH,
    "critica": IncidentPriority.CRITICAL,
}

CATEGORY_MAP = {
    "battery": IncidentCategory.BATTERY,
    "tire": IncidentCategory.TIRE,
    "crash": IncidentCategory.CRASH,
    "engine": IncidentCategory.ENGINE,
    "keys": IncidentCategory.KEYS,
    "other": IncidentCategory.OTHER,
    "uncertain": IncidentCategory.UNCERTAIN,
}


def _uploaded_file_path(file_url: str) -> str:
    relative_path = file_url.removeprefix("/uploads/").lstrip("/")
    return os.path.join(settings.UPLOAD_DIR, relative_path)


def process_incident_async(incident_id: int):
    """Lanza el procesamiento de IA en un hilo separado."""
    thread = threading.Thread(target=_run_processing, args=(incident_id,))
    thread.start()


def _run_processing(incident_id: int):
    import asyncio
    db = SessionLocal()
    try:
        asyncio.run(process_incident(incident_id, db))
    finally:
        db.close()


async def process_incident(incident_id: int, db: Session):
    """Procesa todas las evidencias de un incidente con IA."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        return

    evidences = db.query(Evidence).filter(Evidence.incident_id == incident_id).all()

    # 1. Procesar audios pendientes
    for ev in evidences:
        if ev.type == EvidenceType.AUDIO and not ev.transcription and ev.file_url:
            file_path = _uploaded_file_path(ev.file_url)
            if os.path.exists(file_path):
                try:
                    transcription = await transcribe_audio(file_path)
                    ev.transcription = transcription
                    key_info = await extract_key_info(transcription)
                    ev.ai_analysis = str(key_info)
                    db.commit()
                except Exception as e:
                    ev.ai_analysis = f"Error en transcripcion: {str(e)}"
                    db.commit()

    # 2. Procesar imagenes pendientes
    for ev in evidences:
        if ev.type == EvidenceType.IMAGE and not ev.ai_analysis and ev.file_url:
            file_path = _uploaded_file_path(ev.file_url)
            if os.path.exists(file_path):
                try:
                    analysis = await analyze_vehicle_image(file_path)
                    ev.ai_analysis = str(analysis)
                    db.commit()
                except Exception as e:
                    ev.ai_analysis = f"Error en analisis: {str(e)}"
                    db.commit()

    # 3. Clasificar incidente con todas las evidencias
    db.refresh(incident)
    evidences = db.query(Evidence).filter(Evidence.incident_id == incident_id).all()

    evidence_data = []
    for ev in evidences:
        evidence_data.append({
            "type": ev.type.value,
            "content": ev.content,
            "transcription": ev.transcription,
            "ai_analysis": ev.ai_analysis,
        })

    if evidence_data:
        try:
            classification = await classify_incident(evidence_data)
            incident.category = CATEGORY_MAP.get(
                classification.get("categoria", "uncertain"), IncidentCategory.UNCERTAIN
            )
            incident.priority = PRIORITY_MAP.get(
                classification.get("prioridad", "medium"), IncidentPriority.MEDIUM
            )
            incident.ai_summary = classification.get("resumen", "")
            incident.ai_diagnosis = classification.get("diagnostico_preliminar", "")
            db.commit()
        except Exception as e:
            incident.ai_summary = f"Error en clasificacion: {str(e)}"
            db.commit()
