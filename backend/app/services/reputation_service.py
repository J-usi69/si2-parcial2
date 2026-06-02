"""Politica de reputacion de talleres frente a invitaciones.

Regla del docente: el taller siempre deberia responder si/no. Si no responde
(la invitacion expira) se le resta puntaje para que la proxima vez reciba menos
invitaciones. Aceptar suma; rechazar explicitamente penaliza poco (responder es
mejor que ignorar).
"""
from app.models.invitation import WorkshopInvitation
from app.models.workshop import Workshop

# --- Politica (constantes ajustables) ---
ACCEPT_POINTS = 5       # acepto la invitacion ("yo atiendo")
REJECT_POINTS = -1      # rechazo explicito (responder, aunque sea no, es correcto)
IGNORE_POINTS = -10     # no respondio y expiro (lo que mas penaliza)
MIN_POINTS = 0
MAX_POINTS = 200
START_POINTS = 100

# Ventana de respuesta de una invitacion (segundos).
INVITATION_TIMEOUT_SECONDS = 120

# Umbral de reputacion por debajo del cual el taller recibe menos prioridad.
LOW_REPUTATION_THRESHOLD = 40


def _clamp(value: int) -> int:
    return max(MIN_POINTS, min(MAX_POINTS, value))


def _update_avg_response(workshop: Workshop, response_seconds: int) -> None:
    responded = workshop.invitations_accepted  # ya incrementado por el caller
    if responded <= 1:
        workshop.avg_response_seconds = float(response_seconds)
    else:
        prev = workshop.avg_response_seconds * (responded - 1)
        workshop.avg_response_seconds = round((prev + response_seconds) / responded, 2)


def apply_accept(workshop: Workshop, response_seconds: int) -> None:
    workshop.invitations_accepted += 1
    workshop.reputation_points = _clamp(workshop.reputation_points + ACCEPT_POINTS)
    _update_avg_response(workshop, response_seconds)


def apply_reject(workshop: Workshop) -> None:
    workshop.reputation_points = _clamp(workshop.reputation_points + REJECT_POINTS)


def apply_ignore(workshop: Workshop) -> None:
    """La invitacion expiro sin respuesta: penaliza la reputacion."""
    workshop.invitations_ignored += 1
    workshop.reputation_points = _clamp(workshop.reputation_points + IGNORE_POINTS)


def register_invitation_sent(workshop: Workshop) -> None:
    workshop.invitations_sent += 1


def reputation_factor(workshop: Workshop) -> float:
    """Normaliza la reputacion a 0..1 para ponderar el ranking de invitaciones."""
    return _clamp(workshop.reputation_points) / MAX_POINTS
