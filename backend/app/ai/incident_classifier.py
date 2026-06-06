from app.ai.gemini_client import generate_json


async def classify_incident(evidences: list[dict]) -> dict:
    """
    Clasifica un incidente basandose en todas las evidencias recopiladas.
    Combina texto, transcripciones de audio y analisis de imagenes.
    """
    evidence_summary = ""
    for ev in evidences:
        if ev.get("type") == "text":
            evidence_summary += f"\nTexto del usuario: {ev.get('content', '')}"
        elif ev.get("type") == "audio":
            evidence_summary += f"\nTranscripcion de audio: {ev.get('transcription', '')}"
        elif ev.get("type") == "image":
            evidence_summary += f"\nAnalisis de imagen: {ev.get('ai_analysis', '')}"

    prompt = (
        "Eres un sistema de clasificacion de emergencias vehiculares para RescateYa. "
        "Analiza texto, transcripciones y analisis de imagenes. Si la evidencia indica llanta desinflada, "
        "pinchada, reventada, aplastada o problema de neumatico, usa categoria tire. "
        "Si la evidencia indica auto que no enciende, bateria descargada o luces debiles, usa battery. "
        "Si hay golpe, colision o carroceria danada, usa crash. Responde solo JSON valido con: "
        "categoria (battery/tire/crash/engine/keys/other/uncertain), "
        "prioridad (low/medium/high/critical), resumen, diagnostico_preliminar, "
        "servicios_requeridos (array), requiere_remolque (boolean), "
        "costo_estimado_min (number), costo_estimado_max (number), confianza (number 0-1).\n\n"
        f"Evidencias del incidente:\n{evidence_summary}"
    )
    try:
        return generate_json(prompt)
    except Exception:
        return {
            "categoria": "uncertain",
            "prioridad": "medium",
            "resumen": "La solicitud fue registrada y quedo pendiente de revision del taller.",
            "diagnostico_preliminar": "El analisis automatico no esta disponible en este momento. Un taller debe revisar las evidencias y confirmar el diagnostico.",
            "servicios_requeridos": ["other"],
            "requiere_remolque": False,
            "costo_estimado_min": 0,
            "costo_estimado_max": 0,
            "confianza": 0,
        }
