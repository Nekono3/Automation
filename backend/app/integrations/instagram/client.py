import logging
from typing import Optional, Dict, Any
import httpx

from app.config import settings

logger = logging.getLogger("insta.integration.client")

GRAPH_API_VERSION = "v21.0"
GRAPH_API_BASE_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"


class InstagramClient:
    """
    Client for Meta Graph API to send direct messages and query account details.
    """

    def __init__(self, access_token: Optional[str] = None):
        self.access_token = access_token or settings.META_ACCESS_TOKEN

    async def send_text_message(
        self,
        recipient_id: str,
        text: str,
    ) -> Dict[str, Any]:
        """
        Sends a plain text message to an Instagram user (recipient_id is their IGSID).
        Endpoint: POST /{PAGE_ID_OR_ME}/messages
        """
        if not self.access_token:
            logger.warning("META_ACCESS_TOKEN not set. Outbound message skipped (mock mode).")
            return {"mock": True, "recipient_id": recipient_id, "text": text}

        # Instagram user tokens (IGAA...) use graph.instagram.com, Facebook page tokens use graph.facebook.com
        base_url = "https://graph.instagram.com/v21.0" if self.access_token.startswith("IG") else GRAPH_API_BASE_URL
        url = f"{base_url}/me/messages"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "recipient": {"id": recipient_id},
            "message": {"text": text},
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    logger.info("Successfully sent Instagram message to %s (id: %s)", recipient_id, data.get("message_id"))
                    return data
                else:
                    logger.error(
                        "Failed to send Instagram message: HTTP %d - %s",
                        response.status_code,
                        response.text,
                    )
                    return {"error": response.text, "status_code": response.status_code}
            except Exception as exc:
                logger.error("Exception calling Meta Graph API: %s", exc)
                return {"error": str(exc)}

    async def get_account_profile(self) -> Dict[str, Any]:
        """Queries the linked Instagram Business account info."""
        if not self.access_token:
            return {"error": "META_ACCESS_TOKEN not configured"}

        url = f"{GRAPH_API_BASE_URL}/me"
        params = {
            "fields": "id,name,instagram_business_account{id,username}",
            "access_token": self.access_token,
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(url, params=params)
                return resp.json()
            except Exception as exc:
                return {"error": str(exc)}
