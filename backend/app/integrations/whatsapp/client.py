import logging
from typing import Optional, Dict, Any
import httpx

from app.config import settings

logger = logging.getLogger("insta.whatsapp.client")

GRAPH_API_VERSION = "v21.0"
GRAPH_API_BASE_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"


class WhatsAppClient:
    """
    Client for Meta WhatsApp Business Cloud API.
    Sends text messages and template messages to WhatsApp users.
    Endpoint: POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages
    """

    def __init__(
        self,
        access_token: Optional[str] = None,
        phone_number_id: Optional[str] = None,
    ):
        self.access_token = access_token or settings.WHATSAPP_ACCESS_TOKEN
        self.phone_number_id = phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID

    async def send_text_message(
        self,
        to_phone: str,
        text: str,
        preview_url: bool = False,
    ) -> Dict[str, Any]:
        """
        Sends a plain text message to a WhatsApp user.
        to_phone must be in international format without '+' (e.g. '15556382752' or '996555123456').
        """
        clean_phone = to_phone.replace("+", "").replace(" ", "").replace("-", "")

        if not self.access_token:
            logger.warning("WHATSAPP_ACCESS_TOKEN not set. WhatsApp message skipped (mock mode).")
            return {"mock": True, "to": clean_phone, "text": text}

        url = f"{GRAPH_API_BASE_URL}/{self.phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_phone,
            "type": "text",
            "text": {
                "preview_url": preview_url,
                "body": text,
            },
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    message_id = (
                        data.get("messages", [{}])[0].get("id")
                        if data.get("messages")
                        else None
                    )
                    logger.info("Successfully sent WhatsApp message to %s (id: %s)", clean_phone, message_id)
                    return data
                else:
                    logger.error(
                        "Failed to send WhatsApp message: HTTP %d - %s",
                        response.status_code,
                        response.text,
                    )
                    return {"error": response.text, "status_code": response.status_code}
            except Exception as exc:
                logger.error("Exception calling Meta WhatsApp Cloud API: %s", exc)
                return {"error": str(exc)}
