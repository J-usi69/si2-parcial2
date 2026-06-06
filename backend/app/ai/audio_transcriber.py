import mimetypes

from app.ai.gemini_client import generate_json


async def transcribe_audio(file_path: str) -> str:
    """Transcribe un archivo de audio a texto usando Gemini/Vertex AI."""
    with open(file_path, "rb") as audio_file:
        audio_data = audio_file.read()

    mime_type = mimetypes.guess_type(file_path)[0] or "audio/mp4"
    prompt = (
        "Transcribe este audio de una emergencia vehicular para RescateYa. "
        "El usuario puede hablar en espanol con ruido de calle. "
        "Responde solo JSON valido con el campo transcripcion. "
        "Si no se entiende, usa una cadena vacia."
    )
    result = generate_json(prompt, audio_data, mime_type)
    return str(result.get("transcripcion") or "").strip()


async def extract_key_info(transcription: str) -> dict:
    """Extrae informacion clave de la transcripcion usando Gemini/Vertex AI."""
    if not transcription:
        return {
            "problema": "",
            "urgencia": "media",
            "detalles_adicionales": "No se pudo transcribir el audio.",
            "categoria": "uncertain",
        }

    prompt = (
        "Eres un asistente que analiza descripciones de emergencias vehiculares para RescateYa. "
        "Extrae informacion clave y responde solo JSON valido con los campos: "
        "problema (str), urgencia (baja/media/alta/critica), detalles_adicionales (str), "
        "categoria (battery/tire/crash/engine/keys/other/uncertain).\n\n"
        f"Transcripcion del usuario: {transcription}"
    )
    return generate_json(prompt)
