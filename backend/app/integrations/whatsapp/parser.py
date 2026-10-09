from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger("insta.whatsapp.parser")


@dataclass
class WhatsAppMessageEvent:
    sender_phone: str
    recipient_phone_id: str
    timestamp: int
    message_id: str
    text: Optional[str] = None
    sender_name: Optional[str] = None
    message_type: str = "text"
    raw_event: Dict[str, Any] = field(default_factory=dict)


def parse_whatsapp_payload(payload: Dict[str, Any]) -> List[WhatsAppMessageEvent]:
    """
    Parses a Meta WhatsApp webhook payload into structured WhatsAppMessageEvent objects.
    Payload schema:
    {
      "object": "whatsapp_business_account",
      "entry": [{
        "id": "WABA_ID",
        "changes": [{
          "field": "messages",
          "value": {
            "messaging_product": "whatsapp",
            "metadata": {"phone_number_id": "..."},
            "contacts": [{"profile": {"name": "..."}, "wa_id": "..."}],
            "messages": [{"from": "...", "id": "...", "timestamp": "...", "text": {"body": "..."}, "type": "text"}]
          }
        }]
      }]
    }
    """
    events: List[WhatsAppMessageEvent] = []

    if payload.get("object") != "whatsapp_business_account":
        return events

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            if change.get("field") != "messages":
                continue

            value = change.get("value", {})
            metadata = value.get("metadata", {})
            phone_number_id = str(metadata.get("phone_number_id", ""))

            # Contacts map: wa_id -> profile.name
            contacts_map: Dict[str, str] = {}
            for contact in value.get("contacts", []):
                wa_id = str(contact.get("wa_id", ""))
                name = contact.get("profile", {}).get("name")
                if wa_id and name:
                    contacts_map[wa_id] = name

            # Messages
            for msg in value.get("messages", []):
                try:
                    message_id = str(msg.get("id", ""))
                    sender_phone = str(msg.get("from", ""))
                    timestamp = int(msg.get("timestamp", 0))
                    msg_type = msg.get("type", "text")
                    sender_name = contacts_map.get(sender_phone)

                    text_body = None
                    if msg_type == "text":
                        text_body = msg.get("text", {}).get("body")
                    elif msg_type == "button":
                        text_body = msg.get("button", {}).get("text")
                    elif msg_type == "interactive":
                        interactive = msg.get("interactive", {})
                        if interactive.get("type") == "button_reply":
                            text_body = interactive.get("button_reply", {}).get("title")
                        elif interactive.get("type") == "list_reply":
                            text_body = interactive.get("list_reply", {}).get("title")

                    events.append(
                        WhatsAppMessageEvent(
                            sender_phone=sender_phone,
                            recipient_phone_id=phone_number_id,
                            timestamp=timestamp,
                            message_id=message_id,
                            text=text_body,
                            sender_name=sender_name,
                            message_type=msg_type,
                            raw_event=msg,
                        )
                    )
                except Exception as exc:
                    logger.error("Error parsing WhatsApp webhook message: %s", exc)

    return events
