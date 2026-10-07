import logging
from app.database import AsyncSessionLocal
from app.services.customer_service import CustomerService
from app.services.conversation_service import ConversationService
from app.integrations.instagram.client import InstagramClient
from app.ai.agent import MistralConsultingAgent

logger = logging.getLogger("insta.ai.responder")


async def process_and_reply_background(
    customer_id: int,
    conversation_id: int,
    incoming_text: str,
):
    """
    Background worker that runs the AI agent and delivers the response to Instagram.
    Runs asynchronously without delaying the webhook HTTP response.
    """
    logger.info("Starting background AI response for conv #%d, cust #%d", conversation_id, customer_id)

    async with AsyncSessionLocal() as db:
        customer = await CustomerService.get_by_id(db, customer_id)
        conversation = await ConversationService.get_by_id(db, conversation_id, load_messages=True)

        if not customer or not conversation:
            logger.error("Customer #%d or Conversation #%d not found in background worker.", customer_id, conversation_id)
            return

        if conversation.mode != "ai":
            logger.info("Conversation #%d is in mode '%s'. AI reply suppressed.", conversation_id, conversation.mode)
            return

        agent = MistralConsultingAgent()
        reply_text = await agent.generate_reply(
            db=db,
            customer=customer,
            conversation=conversation,
            incoming_message=incoming_text,
        )

        if not reply_text:
            logger.info("AI generated empty response or mode changed. No message sent.")
            return

        # 1. Record AI response in database
        ai_msg, _ = await ConversationService.record_message(
            db=db,
            conversation_id=conversation.id,
            customer_id=customer.id,
            channel="instagram",
            direction="outbound",
            sender_type="ai",
            text=reply_text,
        )
        logger.info("Saved AI reply #%d in database for conv #%d", ai_msg.id, conversation.id)

        # 2. Send message to Instagram via Meta Graph API
        if customer.instagram_id:
            client = InstagramClient()
            send_result = await client.send_text_message(
                recipient_id=customer.instagram_id,
                text=reply_text,
            )
            logger.info("Meta Graph API delivery result for customer %s: %s", customer.instagram_id, send_result)
