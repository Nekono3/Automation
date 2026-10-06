import hmac
import hashlib
import logging
from typing import Optional

logger = logging.getLogger("insta.webhook.validator")


def validate_meta_signature(
    raw_body: bytes,
    signature_header: Optional[str],
    app_secret: str,
) -> bool:
    """
    Validates Meta's X-Hub-Signature-256 header using HMAC-SHA256.
    If app_secret is not configured (e.g. initial dev), logs a warning and returns True.
    """
    if not app_secret:
        logger.warning("META_APP_SECRET not configured. Skipping webhook signature verification.")
        return True

    if not signature_header or not signature_header.startswith("sha256="):
        logger.error("Missing or malformed X-Hub-Signature-256 header.")
        return False

    expected_signature = signature_header[7:]  # Strip 'sha256=' prefix
    mac = hmac.new(app_secret.encode("utf-8"), msg=raw_body, digestmod=hashlib.sha256)
    computed_signature = mac.hexdigest()

    is_valid = hmac.compare_digest(computed_signature, expected_signature)
    if not is_valid:
        logger.warning("Invalid Meta webhook signature received.")
    return is_valid
