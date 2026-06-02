import json
from typing import Any

from app.config import settings

# Modelos de respaldo: si el principal esta saturado (503 UNAVAILABLE), se
# intenta con el siguiente. Suelen tener disponibilidad independiente.
_FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-flash-latest"]


class AIOverloadedError(RuntimeError):
    """El servicio de IA esta saturado/no disponible temporalmente (503/429)."""


def _is_overload(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(s in msg for s in ("503", "unavailable", "overloaded", "high demand", "429", "resource_exhausted"))


def generate_json(prompt: str, image_bytes: bytes | None = None, mime_type: str = "image/jpeg") -> dict[str, Any]:
    try:
        from google import genai
        from google.genai import types
    except Exception as exc:
        raise RuntimeError("google-genai no esta instalado. Ejecuta pip install -r requirements.txt") from exc

    # Acotar reintentos y timeout para que NUNCA se quede colgado >~25s.
    # Sin esto, el SDK reintenta con backoff largo ante 503 y la peticion
    # puede tardar 45s+ antes de fallar.
    http_options = types.HttpOptions(
        timeout=20_000,  # ms por intento
        retry_options=types.HttpRetryOptions(
            attempts=3,
            initial_delay=1.0,
            max_delay=4.0,
            exp_base=2.0,
            http_status_codes=[429, 500, 502, 503, 504],
        ),
    )
    client = genai.Client(api_key=settings.GEMINI_API_KEY, http_options=http_options)

    contents: list[Any] = [prompt]
    if image_bytes:
        contents.append(types.Part.from_bytes(data=image_bytes, mime_type=mime_type))

    # Desactivar "thinking" reduce la latencia en tareas deterministas
    # como NL->SQL o clasificacion (no necesitan razonamiento extendido).
    config_kwargs: dict[str, Any] = {"response_mime_type": "application/json"}
    try:
        config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
    except Exception:  # noqa: BLE001  -- modelos sin soporte de thinking
        pass
    config = types.GenerateContentConfig(**config_kwargs)

    # Probar el modelo principal y, si esta saturado, los de respaldo.
    models_to_try = [settings.GEMINI_MODEL] + [m for m in _FALLBACK_MODELS if m != settings.GEMINI_MODEL]
    last_overload: Exception | None = None

    for model in models_to_try:
        try:
            response = client.models.generate_content(model=model, contents=contents, config=config)
        except Exception as exc:  # noqa: BLE001
            if _is_overload(exc):
                last_overload = exc
                continue  # probar el siguiente modelo
            raise
        if not response.text:
            raise RuntimeError("Gemini no devolvio contenido")
        return json.loads(response.text)

    raise AIOverloadedError(
        "El modelo de IA esta saturado (alta demanda) en este momento. "
        "Intenta de nuevo en unos segundos."
    ) from last_overload
