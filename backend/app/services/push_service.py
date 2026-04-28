import logging

from app.config import settings

logger = logging.getLogger(__name__)

_firebase_initialized = False


def _init_firebase():
    global _firebase_initialized
    if _firebase_initialized:
        return True
    try:
        import firebase_admin
        from firebase_admin import credentials

        if settings.FIREBASE_CREDENTIALS_PATH:
            cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
            firebase_admin.initialize_app(cred)
            _firebase_initialized = True
            return True
        else:
            logger.warning("FIREBASE_CREDENTIALS_PATH not set, push notifications disabled")
            return False
    except Exception as e:
        logger.warning(f"Firebase init failed: {e}")
        return False


def send_push_notification(token: str, title: str, body: str, data: dict | None = None) -> bool:
    """Send a push notification to a device via Firebase Cloud Messaging."""
    if not _init_firebase():
        return False

    try:
        from firebase_admin import messaging

        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            token=token,
            android=messaging.AndroidConfig(
                priority="high",
                notification=messaging.AndroidNotification(
                    channel_id="high_importance_channel",
                    priority="max",
                    default_sound=True,
                ),
            ),
        )
        response = messaging.send(message)
        logger.info(f"Push notification sent: {response}")
        return True
    except Exception as e:
        logger.warning(f"Push notification failed: {e}")
        return False
