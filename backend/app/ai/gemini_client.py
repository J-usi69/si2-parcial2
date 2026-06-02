import json
from typing import Any

from app.config import settings

# Orden de modelos a intentar. Se prueba el principal y, si esta saturado o sin
# cuota, el siguiente (cada modelo tiene limites de free-tier independientes).
# gemini-2.0-flash es rapido y con mayor cuota gratuita para tareas NL->SQL.
_FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest"]

# Solo reintentamos errores de servidor TRANSITORIOS (no 429: la cuota no se
# recupera en segundos, reintentarla solo alarga la espera inutilmente).
_TRANSIENT_RETRY_CODES = [500, 502, 503]


class AIOverloadedError(RuntimeError):
    """IA saturada, sin cuota o con timeout temporal (429/503/504...)."""


def _is_overload(exc: Exception) -> bool:
    msg = str(exc).lower()
    return any(s in msg for s in (
        "429", "resource_exhausted", "quota",
        "503", "unavailable", "overloaded", "high demand",
        "504", "deadline",
    ))


def generate_json(prompt: str, image_bytes: bytes | None = None, mime_type: str = "image/jpeg") -> dict[str, Any]:
    try:
        from google import genai
        from google.genai import types
    except Exception as exc:
        raise RuntimeError("google-genai no esta instalado. Ejecuta pip install -r requirements.txt") from exc

    # Timeout corto por intento y SIN reintentos del SDK: la resiliencia la da
    # el fallback entre modelos (abajo), cada uno con cuota independiente. Asi
    # cada modelo sin cuota falla en ~1s en vez de hacer backoff largo.
    http_options = types.HttpOptions(
        timeout=10_000,  # ms por intento (corta cualquier cuelgue)
        retry_options=types.HttpRetryOptions(
            attempts=1,
            http_status_codes=_TRANSIENT_RETRY_CODES,
        ),
    )
    client = genai.Client(api_key=settings.GEMINI_API_KEY, http_options=http_options)

    contents: list[Any] = [prompt]
    if image_bytes:
        contents.append(types.Part.from_bytes(data=image_bytes, mime_type=mime_type))

    # Desactivar "thinking" reduce la latencia en tareas deterministas.
    config_kwargs: dict[str, Any] = {"response_mime_type": "application/json"}
    try:
        config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)
    except Exception:  # noqa: BLE001
        pass
    config = types.GenerateContentConfig(**config_kwargs)

    models_to_try = [settings.GEMINI_MODEL] + [m for m in _FALLBACK_MODELS if m != settings.GEMINI_MODEL]
    last_overload: Exception | None = None

    for model in models_to_try:
        try:
            response = client.models.generate_content(model=model, contents=contents, config=config)
        except Exception as exc:  # noqa: BLE001
            if _is_overload(exc):
                last_overload = exc
                continue  # probar el siguiente modelo (cuota/saturacion independiente)
            raise
        if not response.text:
            raise RuntimeError("Gemini no devolvio contenido")
        return json.loads(response.text)

    raise AIOverloadedError(
        "El servicio de IA alcanzo su limite de uso (cuota del plan gratuito) o esta "
        "saturado. Espera ~1 minuto y reintenta, o usa una API key con facturacion."
    ) from last_overload
