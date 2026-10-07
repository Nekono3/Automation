import logging
import json
import re
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config import settings
from app.models.customer import Customer
from app.models.conversation import Conversation
from app.models.message import Message
from app.ai.prompts import SYSTEM_CONSULTING_PROMPT
from app.ai.tools import (
    execute_get_services,
    execute_create_booking,
    execute_confirm_booking,
    execute_request_human_support,
)

logger = logging.getLogger("insta.ai.agent")

try:
    from mistralai.client import Mistral
except ImportError:
    from mistralai import Mistral


class MistralConsultingAgent:
    """
    Intelligent AI Agent powered by Mistral AI.
    Handles customer inquiries, services explanation, booking flow, and human handover.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = api_key or settings.MISTRAL_API_KEY
        self.model = model or settings.AI_MODEL
        self.client = Mistral(api_key=self.api_key) if self.api_key else None

    async def generate_reply(
        self,
        db: AsyncSession,
        customer: Customer,
        conversation: Conversation,
        incoming_message: str,
    ) -> str:
        """
        Processes an incoming message from a customer and returns the AI reply.
        Executes business tools and database updates as needed.
        """
        # If conversation is paused or handed over to human, do not generate
        if conversation.mode != "ai":
            logger.info("Conversation #%d is in %s mode. AI will not respond.", conversation.id, conversation.mode)
            return ""

        # 1. Check for explicit human takeover request
        human_keywords = [
            "человек", "менеджер", "оператор", "живой человек",
            "сотрудник", "консультант человек", "переведи на человека",
            "speak to human", "manager", "operator", "адам"
        ]
        msg_lower = incoming_message.lower()
        if any(kw in msg_lower for kw in human_keywords):
            logger.info("Human handover keyword detected in conversation #%d", conversation.id)
            await execute_request_human_support(
                db=db,
                conversation_id=conversation.id,
                reason=f"Запрос клиента: '{incoming_message}'",
            )
            return "Конечно! Я перевел наш диалог на менеджера. Наш специалист ответит вам в ближайшее время."

        # 2. Load available services from database
        services = await execute_get_services(db)
        services_text = "\n".join(
            [f"- {s['name']} ({s['duration_minutes']} мин): {s['price']} {s['currency']}. {s['description']}" for s in services]
        )

        # 3. Load recent conversation history (last 10 messages)
        history_query = (
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.created_at.desc())
            .limit(10)
        )
        res = await db.execute(history_query)
        recent_messages = list(reversed(res.scalars().all()))

        chat_history = []
        for msg in recent_messages:
            if not msg.text:
                continue
            role = "user" if msg.sender_type == "customer" else "assistant"
            chat_history.append({"role": role, "content": msg.text})

        # Append current incoming message if not in history yet
        if not chat_history or chat_history[-1]["content"] != incoming_message:
            chat_history.append({"role": "user", "content": incoming_message})

        # 4. Construct grounded system prompt
        context_prompt = (
            f"{SYSTEM_CONSULTING_PROMPT}\n\n"
            f"АКТУАЛЬНЫЕ УСЛУГИ КОМПАНИИ (данные из базы данных):\n{services_text}\n\n"
            f"ДАННЫЕ О КЛИЕНТЕ:\n"
            f"- Имя/Ник: {customer.name or customer.username or 'Клиент'}\n"
            f"- Телефон: {customer.phone or 'не указан'}\n"
            f"- Instagram ID: {customer.instagram_id}\n\n"
            f"Инструкция: Отвечай клиенту кратко, полезно и доброжелательно. "
            f"Если клиент выбирает услугу, спроси его имя и телефон, чтобы оформить запись."
        )

        messages = [
            {"role": "system", "content": context_prompt},
            *chat_history,
        ]

        if not self.client:
            logger.warning("Mistral API key not configured. Returning fallback mock response.")
            return "Здравствуйте! Чем мы можем вам помочь по поводу наших консультаций?"

        try:
            response = self.client.chat.complete(
                model=self.model,
                messages=messages,
                temperature=0.4,
                max_tokens=400,
            )
            reply_text = response.choices[0].message.content.strip()

            # 5. Booking detection: check if customer provided phone number or confirms booking
            phone_match = re.search(r"(\+?\d[\d\s\-\(\)]{8,}\d)", incoming_message)
            if phone_match and not customer.phone:
                extracted_phone = phone_match.group(1).replace(" ", "").replace("-", "")
                customer.phone = extracted_phone
                await db.commit()
                logger.info("Captured customer phone number: %s", extracted_phone)

            # Check if any service was selected
            for service in services:
                if service["name"].lower() in incoming_message.lower():
                    # Create draft booking if not already exists
                    await execute_create_booking(
                        db=db,
                        customer_id=customer.id,
                        service_id=service["id"],
                        customer_phone=customer.phone,
                        customer_name=customer.name,
                        notes=f"Запрос из Instagram: {incoming_message}",
                    )
                    break

            return reply_text

        except Exception as exc:
            logger.error("Error generating Mistral response: %s", exc)
            return "Спасибо за ваше сообщение! Наш консультант свяжется с вами в самое ближайшее время."
