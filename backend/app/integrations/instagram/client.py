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
    async def reply_to_comment(
        self,
        comment_id: str,
        text: str,
    ) -> Dict[str, Any]:
        """
        Replies publicly to an Instagram comment under a post/reel.
        Endpoint: POST /{comment_id}/replies
        """
        if not self.access_token:
            logger.warning("META_ACCESS_TOKEN not set. Comment reply skipped (mock mode).")
            return {"mock": True, "comment_id": comment_id, "text": text}

        base_url = "https://graph.instagram.com/v21.0" if self.access_token.startswith("IG") else GRAPH_API_BASE_URL
        url = f"{base_url}/{comment_id}/replies"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }
        payload = {"message": text}

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    logger.info("Successfully replied to comment %s (reply id: %s)", comment_id, data.get("id"))
                    return data
                else:
                    logger.error("Failed to reply to comment: HTTP %d - %s", response.status_code, response.text)
                    return {"error": response.text, "status_code": response.status_code}
            except Exception as exc:
                logger.error("Exception replying to comment: %s", exc)
                return {"error": str(exc)}

    async def send_private_reply(
        self,
        comment_id: str,
        text: str,
    ) -> Dict[str, Any]:
        """
        Sends a private DM to the user who wrote a comment (Comment-to-DM).
        Endpoint: POST /me/messages with recipient = {"comment_id": comment_id}
        """
        if not self.access_token:
            logger.warning("META_ACCESS_TOKEN not set. Private reply skipped (mock mode).")
            return {"mock": True, "comment_id": comment_id, "text": text}

        base_url = "https://graph.instagram.com/v21.0" if self.access_token.startswith("IG") else GRAPH_API_BASE_URL
        url = f"{base_url}/me/messages"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json",
        }
        payload = {
            "recipient": {"comment_id": comment_id},
            "message": {"text": text},
        }

        async with httpx.AsyncClient(timeout=15.0) as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    logger.info("Successfully sent private reply for comment %s (msg: %s)", comment_id, data.get("message_id"))
                    return data
                else:
                    logger.error("Failed to send private reply: HTTP %d - %s", response.status_code, response.text)
                    return {"error": response.text, "status_code": response.status_code}
            except Exception as exc:
                logger.error("Exception sending private reply: %s", exc)
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

    async def get_user_profile(self, user_id: str) -> Dict[str, Any]:
        """
        Fetches the user's public profile (name, username, profile_pic) from Instagram Graph API.
        Endpoint: GET /{user_id}?fields=name,username,profile_pic
        """
        if not self.access_token:
            return {}

        base_url = "https://graph.instagram.com/v21.0" if self.access_token.startswith("IG") else GRAPH_API_BASE_URL
        url = f"{base_url}/{user_id}"
        params = {
            "fields": "name,username,profile_pic",
            "access_token": self.access_token,
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(url, params=params)
                if resp.status_code == 200:
                    data = resp.json()
                    logger.info("Successfully fetched Instagram profile for %s: %s", user_id, data)
                    return data
                else:
                    logger.warning("Failed to fetch Instagram profile for %s: HTTP %d - %s", user_id, resp.status_code, resp.text)
                    return {}
            except Exception as exc:
                logger.error("Exception fetching Instagram user profile for %s: %s", user_id, exc)
                return {}
