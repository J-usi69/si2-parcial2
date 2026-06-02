import json
from typing import Any

from app.config import settings


def generate_json(prompt: str, image_bytes: bytes | None = None, mime_type: str = "image/jpeg") -> dict[str, Any]:
    try:
        from google import genai
        from google.genai import types
    except Exception as exc:
        raise RuntimeError("google-genai no esta instalado. Ejecuta pip install -r requirements.txt") from exc

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    contents: list[Any] = [prompt]
    if image_bytes:
        contents.append(types.Part.from_bytes(data=image_bytes, mime_type=mime_type))

    # Desactivar "thinking" reduce mucho la latencia en tareas deterministas
    # como NL->SQL o clasificacion (no necesitan razonamiento extendido).
    config_kwargs: dict[str, Any] = {"response_mime_type": "application/json"}
    try:
        config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
    except Exception:  # noqa: BLE001  -- modelos sin soporte de thinking
        pass

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=contents,
        config=types.GenerateContentConfig(**config_kwargs),
    )
    if not response.text:
        raise RuntimeError("Gemini no devolvio contenido")
    return json.loads(response.text)