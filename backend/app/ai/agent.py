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
from app.models.deal import Deal
from app.models.student_profile import StudentProfile
from app.ai.prompts import SYSTEM_CONSULTING_PROMPT
from app.ai.tools import (
    execute_get_services,
    execute_create_booking,
    execute_confirm_booking,
    execute_request_human_support,
)
from app.services.automation_service import AutomationService
from app.services.student_service import StudentService
from app.schemas.student_profile import StudentProfileUpdate
from app.schemas.deal import DealCreate, DealStageUpdate
from app.services.deal_service import DealService

logger = logging.getLogger("insta.ai.agent")

try:
    from mistralai.client import Mistral
except ImportError:
    from mistralai import Mistral


class MistralConsultingAgent:
    """
    Intelligent AI Agent for Consulteam EdTech Admissions Agency.
    Handles keyword automations (Comment-to-DM), applicant qualification,
    student profile building, and consultation scheduling.
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
        Executes business tools, automations, and database updates as needed.
        """
        if conversation.mode != "ai":
            logger.info("Conversation #%d is in %s mode. AI will not respond.", conversation.id, conversation.mode)
            return ""

        channel = conversation.channel or "instagram"

        # 1. Check for Keyword Automations (e.g. "ГРАНТ", "ИТАЛИЯ", "ГАЙД", "США")
        matched_trigger = await AutomationService.match_trigger(
            db=db,
            text=incoming_message,
            channel="INSTAGRAM" if channel == "instagram" else "WHATSAPP",
        )
        if matched_trigger:
            logger.info("Triggering keyword automation '%s' for customer #%d", matched_trigger.keyword, customer.id)
            # Ensure Deal exists in SALES pipeline
            deals = await DealService.list_deals(db, pipeline_type="SALES", customer_id=customer.id)
            if not deals:
                await DealService.create_deal(
                    db=db,
                    data=DealCreate(
                        title=f"{customer.name or 'Абитуриент'}: {matched_trigger.keyword}",
                        customer_id=customer.id,
                        pipeline_type="SALES",
                        stage=matched_trigger.target_pipeline_stage or "NEW_LEAD",
                    ),
                )

            reply = matched_trigger.dm_reply_text
            if matched_trigger.attachment_url and matched_trigger.attachment_url not in reply:
                reply += f"\n\n📄 Материал: {matched_trigger.attachment_url}"
            return reply

        # 2. Check for explicit human takeover request
        human_keywords = [
            "человек", "менеджер", "оператор", "живой человек",
            "сотрудник", "консультант человек", "переведи на человека",
            "speak to human", "manager", "operator", "адам", "эксперт человек"
        ]
        msg_lower = incoming_message.lower()
        if any(kw in msg_lower for kw in human_keywords):
            logger.info("Human handover keyword detected in conversation #%d", conversation.id)
            await execute_request_human_support(
                db=db,
                conversation_id=conversation.id,
                reason=f"Запрос клиента: '{incoming_message}'",
            )
            return "Конечно! Я перевел наш диалог на менеджера Consulteam. Наш ведущий консультант подключится в течение нескольких минут."

        # 3. Load available services from database
        services = await execute_get_services(db)
        services_text = "\n".join(
            [f"- {s['name']} ({s['duration_minutes']} мин): {s['price']} {s['currency']}. {s['description']}" for s in services]
        )

        # 4. Load recent conversation history (last 10 messages)
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

        if not chat_history or chat_history[-1]["content"] != incoming_message:
            chat_history.append({"role": "user", "content": incoming_message})

        # Load student profile if exists
        profile = await StudentService.get_by_customer_id(db, customer.id)
        profile_summary = ""
        if profile:
            profile_summary = (
                f"- Класс/статус: {profile.current_grade_or_status or 'не указан'}\n"
                f"- Целевые страны: {', '.join(profile.target_countries) if profile.target_countries else 'не выбраны'}\n"
                f"- Степень: {profile.target_degree or 'Бакалавриат'}\n"
                f"- Тесты: {json.dumps(profile.language_tests, ensure_ascii=False) if profile.language_tests else 'нет данных'}\n"
            )

        # 5. Construct grounded system prompt
        context_prompt = (
            f"{SYSTEM_CONSULTING_PROMPT}\n\n"
            f"ТЕКУЩИЙ ПРОФИЛЬ АБИТУРИЕНТА:\n{profile_summary or '- Профиль еще заполняется'}\n\n"
            f"АКТУАЛЬНЫЕ УСЛУГИ И КОНСУЛЬТАЦИИ:\n{services_text}\n\n"
            f"КОНТЕКСТ ДИАЛОГА:\n"
            f"- Канал обращения: {'WhatsApp' if channel == 'whatsapp' else 'Instagram Direct'}\n"
            f"- Имя/Ник: {customer.name or customer.username or 'Абитуриент'}\n"
            f"- Телефон / WhatsApp ID: {customer.phone or customer.whatsapp_id or 'не указан'}\n"
            f"- Instagram ID: {customer.instagram_id or 'не указан'}\n\n"
            f"Инструкция: Отвечай кратко, доброжелательно и квалифицируй абитуриента. "
            f"Когда параметры ясны — веди на бесплатную консультацию в офис в Бишкеке или Zoom."
        )

        messages = [
            {"role": "system", "content": context_prompt},
            *chat_history,
        ]

        if not self.client:
            logger.warning("Mistral API key not configured. Returning fallback Consulteam response.")
            return "Салам! Рады приветствовать вас в Consulteam (@consulteam.kg) 🎓 Подскажите, в какую страну вы рассматриваете поступление и в каком классе сейчас учитесь?"

        try:
            response = self.client.chat.complete(
                model=self.model,
                messages=messages,
                temperature=0.4,
                max_tokens=400,
            )
            reply_text = response.choices[0].message.content.strip()

            # 6. Entity Extraction for StudentProfile
            profile_updates: Dict[str, Any] = {}

            # Countries extraction
            countries_map = {
                "италия": "Италия",
                "италь": "Италия",
                "сша": "США",
                "америк": "США",
                "коре": "Корея",
                "герман": "Германия",
                "турци": "Турция",
                "китай": "Китай",
                "канада": "Канада",
                "англия": "Великобритания",
                "европ": "Европа",
            }
            detected_countries = []
            for k, val in countries_map.items():
                if k in msg_lower and val not in detected_countries:
                    detected_countries.append(val)
            if detected_countries:
                existing_countries = profile.target_countries if profile else []
                combined_countries = list(set(existing_countries + detected_countries))
                profile_updates["target_countries"] = combined_countries

            # Grade extraction
            grade_match = re.search(r"(\b\d{1,2}\s*(?:класс|курс)\b)", msg_lower)
            if grade_match:
                profile_updates["current_grade_or_status"] = grade_match.group(1).title()
            elif "выпускник" in msg_lower or "закончил" in msg_lower:
                profile_updates["current_grade_or_status"] = "Выпускник"

            # Degree extraction
            if "магистр" in msg_lower:
                profile_updates["target_degree"] = "MASTER"
            elif "бакалавр" in msg_lower:
                profile_updates["target_degree"] = "BACHELOR"

            # Tests extraction
            tests_dict = profile.language_tests.copy() if (profile and profile.language_tests) else {}
            if "ielts" in msg_lower:
                ielts_score = re.search(r"ielts\s*(\d(?:\.\d)?)", msg_lower)
                tests_dict["ielts"] = float(ielts_score.group(1)) if ielts_score else "Сдавал(а)"
                profile_updates["language_tests"] = tests_dict
            elif "duolingo" in msg_lower or "дуолинго" in msg_lower:
                tests_dict["duolingo"] = "Сдавал(а)"
                profile_updates["language_tests"] = tests_dict

            # Budget / Scholarship
            if "грант" in msg_lower or "стипенди" in msg_lower or "бесплатн" in msg_lower:
                profile_updates["budget_expectation"] = "FULL_SCHOLARSHIP_ONLY"

            # Save student profile if any data detected
            if profile_updates:
                await StudentService.upsert_profile(
                    db=db,
                    customer_id=customer.id,
                    data=StudentProfileUpdate(**profile_updates),
                )
                logger.info("Updated StudentProfile for customer #%d: %s", customer.id, profile_updates)

            # 7. Customer phone & name detection
            phone_match = re.search(r"(\+?\d[\d\s\-\(\)]{8,}\d)", incoming_message)
            if phone_match:
                extracted_phone = phone_match.group(1).replace(" ", "").replace("-", "")
                customer.phone = extracted_phone
                await db.commit()
                logger.info("Captured customer phone number: %s", extracted_phone)

            name_match = re.search(r"(?:меня зовут|имя)\s+([А-Яа-яЁёA-Za-z\-]+(?:\s+[А-Яа-яЁёA-Za-z\-]+)?)", incoming_message, re.IGNORECASE)
            if name_match:
                extracted_name = name_match.group(1).strip()
                customer.name = extracted_name
                await db.commit()
                logger.info("Captured customer name: %s", extracted_name)

            # 8. Deal Pipeline Sync
            deals = await DealService.list_deals(db, pipeline_type="SALES", customer_id=customer.id)
            lead_deal = deals[0] if deals else None
            if not lead_deal:
                lead_deal = await DealService.create_deal(
                    db=db,
                    data=DealCreate(
                        title=f"{customer.name or 'Абитуриент'} ({customer.username or customer.phone or 'Лид'})",
                        customer_id=customer.id,
                        pipeline_type="SALES",
                        stage="NEW_LEAD",
                    ),
                )

            # Check if qualified
            if lead_deal.stage == "NEW_LEAD" and (detected_countries or "current_grade_or_status" in profile_updates):
                await DealService.update_stage(db, lead_deal.id, DealStageUpdate(stage="AI_QUALIFIED"))

            # 9. Booking Detection
            combined_text = f"{incoming_message} {reply_text}".lower()
            booking_directives = [
                "записываю вас", "подтверждаю запись", "запись успешно оформлена",
                "запись подтверждена", "записал вас на консультацию", "ждем вас в офисе"
            ]
            is_booking_flow = any(d in reply_text.lower() for d in booking_directives) or (bool(phone_match) and "консультац" in combined_text)

            if is_booking_flow:
                if lead_deal and lead_deal.stage in ["NEW_LEAD", "AI_QUALIFIED"]:
                    await DealService.update_stage(db, lead_deal.id, DealStageUpdate(stage="CONSULTATION_SCHEDULED"))

                matched_service = services[0] if services else None
                if matched_service:
                    from app.models.booking import Booking
                    existing_q = (
                        select(Booking)
                        .where(
                            Booking.customer_id == customer.id,
                            Booking.service_id == matched_service["id"],
                            Booking.status.in_(["draft", "awaiting_confirmation", "confirmed"]),
                        )
                        .order_by(Booking.id.desc())
                        .limit(1)
                    )
                    existing_res = await db.execute(existing_q)
                    existing_booking = existing_res.scalar_one_or_none()

                    if not existing_booking:
                        await execute_create_booking(
                            db=db,
                            customer_id=customer.id,
                            service_id=matched_service["id"],
                            customer_phone=customer.phone,
                            customer_name=customer.name,
                            notes=f"Consulteam AI Lead: {incoming_message}",
                        )

            return reply_text

        except Exception as exc:
            logger.error("Error generating Mistral response: %s", exc)
            return "Салам! Спасибо за обращение в Consulteam 🎓 Наш ведущий консультант ответит вам в течение нескольких минут."
