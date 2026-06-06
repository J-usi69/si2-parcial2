import json
from typing import Any

from app.ai.gemini_client import generate_json
from app.models.user import User
from app.schemas.assistant import AssistantContextRequest, AssistantContextResponse


SCREEN_GUIDES: dict[str, dict[str, Any]] = {
    "web:/dashboard": {
        "message": "Este panel resume la operacion del taller. Revisa solicitudes pendientes, actividad reciente y accesos rapidos antes de entrar al detalle de un incidente.",
        "actions": ["ir_a_incidentes", "ir_a_reportes"],
    },
    "web:/incidents": {
        "message": "Aqui gestionas solicitudes de auxilio. Abre un incidente pendiente, revisa categoria, ubicacion y evidencias, y envia una oferta con costo, ETA y tecnico sugerido.",
        "actions": ["abrir_incidente", "enviar_oferta"],
    },
    "web:/technicians": {
        "message": "Desde esta pantalla administra los tecnicos del taller. Mantén sus datos y disponibilidad actualizados para asignarlos mejor a cada servicio.",
        "actions": ["ir_a_tecnicos", "crear_tecnico"],
    },
    "web:/history": {
        "message": "Este historial sirve para revisar servicios anteriores, estados finales y datos utiles para seguimiento operativo.",
        "actions": ["ir_a_historial", "ver_detalle"],
    },
    "web:/reports": {
        "message": "Los reportes ayudan a revisar rendimiento, pagos, comisiones y volumen de atenciones para tomar decisiones del taller o plataforma.",
        "actions": ["ir_a_reportes", "revisar_metricas"],
    },
    "web:/profile": {
        "message": "Aqui puedes revisar y actualizar los datos de tu cuenta. Mantén telefono y perfil correctos para recibir notificaciones y contacto operativo.",
        "actions": ["ir_a_perfil", "actualizar_perfil"],
    },
    "web:/admin/users": {
        "message": "Aqui administras usuarios de la plataforma. Revisa roles, actividad y datos de contacto antes de hacer cambios.",
        "actions": ["ir_a_usuarios", "ir_a_talleres"],
    },
    "web:/admin/workshops": {
        "message": "Aqui supervisas talleres registrados, disponibilidad y datos operativos de la plataforma.",
        "actions": ["ir_a_talleres", "ir_a_reportes"],
    },
    "web:/admin/payments": {
        "message": "Aqui revisas pagos, montos y comisiones de la plataforma. Usa estos datos para validar el cierre economico de los servicios.",
        "actions": ["ir_a_pagos", "ir_a_reportes"],
    },
    "mobile:home": {
        "message": "En Inicio puedes ver tus emergencias recientes y su estado. Para pedir auxilio nuevo usa el boton SOS de la barra inferior.",
        "actions": ["crear_emergencia", "revisar_estado"],
    },
    "mobile:vehicles": {
        "message": "Registra al menos un vehiculo antes de reportar una emergencia. La app usa ese dato para que el taller entienda mejor el caso.",
        "actions": ["agregar_vehiculo", "editar_vehiculo"],
    },
    "mobile:new_emergency": {
        "message": "Para reportar una emergencia selecciona tu vehiculo, confirma ubicacion, agrega descripcion y evidencias. Mientras mas claro sea el reporte, mejores ofertas recibiras.",
        "actions": ["confirmar_ubicacion", "agregar_foto", "enviar_reporte"],
    },
    "mobile:notifications": {
        "message": "Aqui aparecen alertas de ofertas, cambios de estado y mensajes importantes sobre tus servicios.",
        "actions": ["abrir_notificacion", "marcar_como_leida"],
    },
    "mobile:profile": {
        "message": "En Perfil puedes revisar tu cuenta, cerrar sesion y mantener tus datos de contacto actualizados.",
        "actions": ["actualizar_perfil"],
    },
    "mobile:technician_jobs": {
        "message": "Esta es tu bandeja de trabajos asignados. Comparte ubicacion, abre la ruta, cambia a en camino cuando salgas y sube evidencia al atender el servicio.",
        "actions": ["compartir_ubicacion", "abrir_ruta", "subir_evidencia"],
    },
}

SUPPORTED_ACTIONS = {
    "abrir_incidente",
    "abrir_notificacion",
    "abrir_ruta",
    "actualizar_perfil",
    "agregar_foto",
    "agregar_vehiculo",
    "compartir_ubicacion",
    "confirmar_ubicacion",
    "crear_emergencia",
    "crear_tecnico",
    "enviar_oferta",
    "enviar_reporte",
    "explicar_pantalla",
    "ir_a_historial",
    "ir_a_incidentes",
    "ir_a_pagos",
    "ir_a_perfil",
    "ir_a_reportes",
    "ir_a_talleres",
    "ir_a_tecnicos",
    "ir_a_usuarios",
    "marcar_como_leida",
    "revisar_estado",
    "revisar_metricas",
    "siguiente_paso",
    "subir_evidencia",
    "ver_detalle",
}


def _normalize_actions(actions: list[Any], fallback_actions: list[str]) -> list[str]:
    normalized: list[str] = []
    for action in actions:
        action_key = str(action).strip().lower().replace(" ", "_")
        if action_key in SUPPORTED_ACTIONS and action_key not in normalized:
            normalized.append(action_key)
    if normalized:
        return normalized[:4]
    return fallback_actions[:4]


def _screen_key(platform: str, screen: str) -> str:
    normalized_platform = platform.strip().lower()
    normalized_screen = screen.strip().lower()
    return f"{normalized_platform}:{normalized_screen}"


def _fallback_response(data: AssistantContextRequest, user: User) -> AssistantContextResponse:
    guide = SCREEN_GUIDES.get(_screen_key(data.platform, data.screen))
    if guide:
        return AssistantContextResponse(
            message=guide["message"],
            suggested_actions=guide["actions"],
            source="rules",
        )

    role_label = user.role.value
    if data.platform == "web":
        message = "Puedo ayudarte a ubicar el siguiente paso en el panel. Revisa la barra lateral, entra a la seccion relacionada y dime que intentas hacer."
    else:
        message = "Puedo guiarte dentro de la app movil. Dime que quieres lograr y usare la pantalla actual para darte el siguiente paso."

    return AssistantContextResponse(
        message=f"{message} Tu rol actual es {role_label}.",
        suggested_actions=["explicar_pantalla", "siguiente_paso"],
        source="rules",
    )


def get_contextual_help(data: AssistantContextRequest, user: User) -> AssistantContextResponse:
    fallback = _fallback_response(data, user)
    compact_context = json.dumps(data.visible_state, ensure_ascii=False, default=str)[:2500]
    user_question = (data.question or "Que debo hacer en esta pantalla?").strip()

    prompt = f"""
Eres el Asistente IA contextual de RescateYa, una plataforma de auxilio mecanico vehicular.
Ayudas al usuario a usar la app segun su rol y la pantalla actual. No inventes datos que no esten en el contexto.
Responde en espanol claro, breve y accionable. No pidas claves, contrasenas ni datos sensibles.
Si faltan datos, indica el siguiente paso mas probable.

Rol del usuario: {user.role.value}
Plataforma: {data.platform}
Pantalla actual: {data.screen}
Pregunta del usuario: {user_question}
Estado visible resumido: {compact_context}

Devuelve solo JSON valido con esta forma:
{{
  "message": "respuesta breve de maximo 3 frases",
    "suggested_actions": ["accion_corta_1", "accion_corta_2"]
}}
Acciones permitidas: {", ".join(sorted(SUPPORTED_ACTIONS))}.
""".strip()

    try:
        ai_response = generate_json(prompt)
        message = str(ai_response.get("message") or fallback.message).strip()
        actions = ai_response.get("suggested_actions") or fallback.suggested_actions
        if not isinstance(actions, list):
            actions = fallback.suggested_actions
        return AssistantContextResponse(
            message=message,
            suggested_actions=_normalize_actions(actions, fallback.suggested_actions),
            source="gemini",
        )
    except Exception:
        return fallback