"""Reportes dinamicos a partir de lenguaje natural (NL -> SQL).

El usuario escribe un prompt ("clientes con incidencias en el ultimo mes") y
Gemini lo traduce a una consulta SQL SELECT sobre un esquema permitido. Antes de
ejecutar, un guard de seguridad valida que sea de solo lectura, sobre tablas de
la lista blanca, con LIMIT, y -- para usuarios de un tenant -- que filtre por su
tenant_id (aislamiento multitenant).
"""
import re

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.ai.gemini_client import generate_json

# Tablas que el generador puede consultar.
ALLOWED_TABLES = {
    "tenants", "workshops", "technicians", "users", "vehicles", "incidents",
    "service_offers", "workshop_invitations", "payments", "payment_cards",
    "reviews", "evidences", "service_category_sla", "notifications",
    "status_history", "chat_messages",
}

# Tablas que tienen tenant_id (deben filtrarse para usuarios de un tenant).
TENANT_SCOPED_TABLES = {"workshops", "technicians", "incidents", "service_offers", "workshop_invitations"}

FORBIDDEN = re.compile(
    r"\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|"
    r"merge|replace|call|do|copy|vacuum|comment|attach|pragma)\b",
    re.IGNORECASE,
)

DEFAULT_LIMIT = 500

SCHEMA_DOC = """
Esquema (PostgreSQL). Nombres de tabla y columnas principales:
- tenants(id, name, slug, is_active, created_at)  -- cada tenant es un taller
- workshops(id, tenant_id, user_id, name, address, latitude, longitude, is_available, capacity, services, rating, total_ratings, reputation_points, invitations_sent, invitations_accepted, invitations_ignored, created_at)
- technicians(id, tenant_id, workshop_id, user_id, name, phone, specialties, is_available, created_at)
- users(id, tenant_id, email, full_name, phone, role, is_active, created_at)  -- role: client/workshop/technician/admin (en MAYUSCULAS en la BD: CLIENT, WORKSHOP, ...)
- vehicles(id, user_id, brand, model, year, color, plate_number)
- incidents(id, user_id, vehicle_id, tenant_id, workshop_id, technician_id, category, priority, status, description, latitude, longitude, address, final_cost, commission_amount, created_at, assigned_at, en_route_at, arrived_at, completed_at, cancelled_at, cancel_reason)
  -- category/priority/status se guardan en MAYUSCULAS (BATTERY, HIGH, COMPLETED, ...)
- service_offers(id, incident_id, tenant_id, workshop_id, technician_id, cost, estimated_arrival, distance_km, score, status, created_at)
- workshop_invitations(id, incident_id, workshop_id, tenant_id, status, distance_km, sent_at, expires_at, responded_at, response_time_seconds)
- payments(id, incident_id, amount, commission_amount, payment_method, status, created_at)
- reviews(id, incident_id, user_id, workshop_id, rating, comment, created_at)
- service_category_sla(id, tenant_id, category, expected_assignment_min, expected_arrival_min, expected_completion_min)
"""


class ReportError(Exception):
    pass


def _strip_sql(raw: str) -> str:
    sql = raw.strip().rstrip(";").strip()
    # Quitar fences de markdown si los hubiera.
    if sql.startswith("```"):
        sql = re.sub(r"^```[a-zA-Z]*", "", sql).strip().rstrip("`").strip()
    return sql


def _referenced_tables(sql: str) -> set[str]:
    return {m.lower() for m in re.findall(r"\b(?:from|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)", sql, re.IGNORECASE)}


def _validate_sql(sql: str, tenant_id: int | None) -> str:
    lowered = sql.lower()
    if not lowered.startswith("select") and not lowered.startswith("with"):
        raise ReportError("Solo se permiten consultas SELECT de lectura.")
    if ";" in sql:
        raise ReportError("No se permiten multiples sentencias.")
    if FORBIDDEN.search(sql):
        raise ReportError("La consulta contiene operaciones no permitidas (solo lectura).")

    tables = _referenced_tables(sql)
    unknown = tables - ALLOWED_TABLES
    if unknown:
        raise ReportError(f"Tablas no permitidas: {', '.join(sorted(unknown))}.")

    # Aislamiento multitenant: un usuario de tenant solo ve datos de su tenant.
    if tenant_id is not None:
        touches_scoped = tables & TENANT_SCOPED_TABLES
        if touches_scoped and f"tenant_id = {tenant_id}" not in lowered.replace(" ", " "):
            # Verificacion laxa de espacios.
            if not re.search(rf"tenant_id\s*=\s*{tenant_id}\b", sql):
                raise ReportError("La consulta debe filtrar por tu tenant_id.")

    # Forzar LIMIT.
    if not re.search(r"\blimit\b", lowered):
        sql = f"{sql}\nLIMIT {DEFAULT_LIMIT}"
    return sql


def _build_prompt(user_prompt: str, tenant_id: int | None) -> str:
    scope = (
        f"El usuario pertenece al tenant {tenant_id}. TODA tabla con tenant_id "
        f"(workshops, technicians, incidents, service_offers, workshop_invitations) "
        f"DEBE filtrarse con 'tenant_id = {tenant_id}'."
        if tenant_id is not None
        else "El usuario es administrador de la plataforma: puede consultar todos los tenants."
    )
    return f"""Eres un generador de SQL de SOLO LECTURA para PostgreSQL.
{SCHEMA_DOC}

Reglas:
- Devuelve EXCLUSIVAMENTE una sentencia SELECT (puedes usar JOIN, WHERE, GROUP BY, ORDER BY, agregaciones).
- Prohibido INSERT/UPDATE/DELETE/DROP/ALTER/CREATE u otras operaciones de escritura.
- Usa solo las tablas y columnas del esquema. Incluye siempre un LIMIT razonable (<= {DEFAULT_LIMIT}).
- Recuerda que category/priority/status/role se almacenan en MAYUSCULAS.
- {scope}

Solicitud del usuario: "{user_prompt}"

Responde en JSON con esta forma exacta:
{{"sql": "<la consulta SELECT>", "title": "<titulo corto del reporte>"}}"""


def generate_report(db: Session, user_prompt: str, tenant_id: int | None) -> dict:
    """Traduce el prompt a SQL, valida y ejecuta. Devuelve sql, columnas y filas."""
    if not user_prompt or not user_prompt.strip():
        raise ReportError("El prompt no puede estar vacio.")

    try:
        result = generate_json(_build_prompt(user_prompt, tenant_id))
    except Exception as exc:  # noqa: BLE001
        raise ReportError(f"No se pudo generar el reporte con IA: {exc}") from exc

    raw_sql = result.get("sql") if isinstance(result, dict) else None
    title = (result.get("title") if isinstance(result, dict) else None) or "Reporte"
    if not raw_sql:
        raise ReportError("La IA no devolvio una consulta.")

    sql = _validate_sql(_strip_sql(raw_sql), tenant_id)

    # Ejecutar en transaccion de solo lectura.
    try:
        conn = db.connection()
        conn.execute(text("SET TRANSACTION READ ONLY"))
        cursor = conn.execute(text(sql))
        columns = list(cursor.keys())
        rows = [list(row) for row in cursor.fetchall()]
    except ReportError:
        raise
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        raise ReportError(f"Error al ejecutar la consulta: {exc}") from exc
    finally:
        db.rollback()  # nunca persistir nada

    # Serializar valores no-JSON (datetime, Decimal) a str.
    serializable = [[_to_serializable(v) for v in row] for row in rows]
    return {"title": title, "sql": sql, "columns": columns, "rows": serializable, "row_count": len(serializable)}


def _to_serializable(value):
    from datetime import date, datetime
    from decimal import Decimal

    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return value
