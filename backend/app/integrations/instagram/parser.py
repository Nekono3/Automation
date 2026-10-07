from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger("insta.webhook.parser")


@dataclass
class InstagramMessageEvent:
    sender_id: str
    recipient_id: str
    timestamp: int
    message_id: str
    text: Optional[str] = None
    attachments: List[Dict[str, Any]] = field(default_factory=list)
    is_echo: bool = False
    quick_reply_payload: Optional[str] = None
    raw_event: Dict[str, Any] = field(default_factory=dict)


def parse_instagram_payload(payload: Dict[str, Any]) -> List[InstagramMessageEvent]:
    """
    Parses a Meta Instagram webhook payload into structured InstagramMessageEvent objects.
    Extracts text, attachments, echo status, and unique message IDs.
    """
    events: List[InstagramMessageEvent] = []

    if payload.get("object") != "instagram":
        return events

    for entry in payload.get("entry", []):
        # 1. Standard format: entry.messaging
        items = list(entry.get("messaging", []))

        # 2. Changes format (v21.0 / test console): entry.changes
        for change in entry.get("changes", []):
            if change.get("field") == "messages" and isinstance(change.get("value"), dict):
                items.append(change["value"])

        for messaging_item in items:
            try:
                sender_id = str(messaging_item.get("sender", {}).get("id", ""))
                recipient_id = str(messaging_item.get("recipient", {}).get("id", ""))
                timestamp = int(messaging_item.get("timestamp", 0))

                message_data = messaging_item.get("message")
                if not message_data:
                    continue

                message_id = message_data.get("mid", "")
                text = message_data.get("text")
                is_echo = bool(message_data.get("is_echo", False))
                attachments = message_data.get("attachments", [])

                quick_reply = message_data.get("quick_reply", {}).get("payload")

                events.append(
                    InstagramMessageEvent(
                        sender_id=sender_id,
                        recipient_id=recipient_id,
                        timestamp=timestamp,
                        message_id=message_id,
                        text=text,
                        attachments=attachments,
                        is_echo=is_echo,
                        quick_reply_payload=quick_reply,
                        raw_event=messaging_item,
                    )
                )
            except Exception as exc:
                logger.error("Error parsing individual messaging event in webhook: %s", exc)

    return events
