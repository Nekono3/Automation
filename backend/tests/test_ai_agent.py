import uuid
import pytest
from app.services.customer_service import CustomerService
from app.services.conversation_service import ConversationService
from app.services.service_catalog import ServiceCatalogService
from app.ai.agent import MistralConsultingAgent


@pytest.mark.asyncio
async def test_ai_agent_consulting_reply(db_session):
    # Ensure default services are seeded
    await ServiceCatalogService.seed_default_services(db_session)

    unique_ig = f"ig_{uuid.uuid4().hex[:8]}"
    customer, _ = await CustomerService.get_or_create_by_instagram_id(
        db_session, instagram_id=unique_ig, username="consulting_inquirer"
    )
    conversation, _ = await ConversationService.get_or_create_conversation(
        db_session, customer_id=customer.id
    )

    agent = MistralConsultingAgent()
    reply = await agent.generate_reply(
        db=db_session,
        customer=customer,
        conversation=conversation,
        incoming_message="Здравствуйте! Какие консультации у вас есть и сколько они стоят?",
    )

    assert reply != ""
    assert isinstance(reply, str)
    # Reply should be helpful and mention consultations or prices
    assert len(reply) > 20


@pytest.mark.asyncio
async def test_ai_agent_human_takeover_trigger(db_session):
    unique_ig = f"ig_{uuid.uuid4().hex[:8]}"
    customer, _ = await CustomerService.get_or_create_by_instagram_id(
        db_session, instagram_id=unique_ig, username="frustrated_user"
    )
    conversation, _ = await ConversationService.get_or_create_conversation(
        db_session, customer_id=customer.id
    )
    assert conversation.mode == "ai"

    agent = MistralConsultingAgent()
    reply = await agent.generate_reply(
        db=db_session,
        customer=customer,
        conversation=conversation,
        incoming_message="Позовите мне живого человека менеджера пожалуйста",
    )

    # Conversation mode should now be switched to 'human'
    updated_conv = await ConversationService.get_by_id(db_session, conversation.id, load_messages=False)
    assert updated_conv.mode == "human"
    assert "менеджер" in reply.lower() or "специалист" in reply.lower()
