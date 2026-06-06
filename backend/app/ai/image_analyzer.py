import mimetypes

from app.ai.gemini_client import generate_json


async def analyze_vehicle_image(image_path: str) -> dict:
    """Analiza una imagen de vehiculo usando Gemini/Vertex AI para detectar danos."""
    with open(image_path, "rb") as f:
        image_data = f.read()

    mime_type = mimetypes.guess_type(image_path)[0] or "image/jpeg"
    prompt = (
        "Eres un experto en mecanica automotriz que analiza imagenes para RescateYa. "
        "Identifica danos visibles, tipo de problema y gravedad. Pon atencion especial a llantas bajas, "
        "llantas reventadas, neumativos desinflados, rines danados, golpes visibles, fugas, humo o partes rotas. "
        "Si la imagen muestra una llanta desinflada o aplastada contra el piso, clasifica categoria como tire. "
        "Responde solo JSON valido con: "
        "danos_detectados (array), categoria (battery/tire/crash/engine/keys/other), "
        "gravedad (leve/moderado/grave), descripcion, requiere_remolque (boolean)."
    )
    try:
        return generate_json(prompt, image_data, mime_type)
    except Exception:
        return {
            "danos_detectados": [],
            "categoria": "other",
            "gravedad": "moderado",
            "descripcion": "La imagen quedo registrada, pero el analisis automatico no estuvo disponible. Requiere revision del taller.",
            "requiere_remolque": False,
        }
