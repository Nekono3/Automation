import uuid
import pytest
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.customer_service import CustomerService
from app.services.conversation_service import ConversationService
from app.services.service_catalog import ServiceCatalogService
from app.services.booking_service import BookingService
from app.schemas.booking import BookingCreate


@pytest.mark.asyncio
async def test_customer_creation_and_deduplication(db_session: AsyncSession):
    unique_ig = f"ig_{uuid.uuid4().hex[:8]}"
    cust1, created1 = await CustomerService.get_or_create_by_instagram_id(
        db_session, instagram_id=unique_ig, username="client_alice", name="Alice"
    )
    assert created1 is True
    assert cust1.id is not None
    assert cust1.username == "client_alice"

    # Call again with same instagram_id -> should return existing customer
    cust2, created2 = await CustomerService.get_or_create_by_instagram_id(
        db_session, instagram_id=unique_ig, username="client_alice"
    )
    assert created2 is False
    assert cust2.id == cust1.id


@pytest.mark.asyncio
async def test_conversation_and_mode_switching(db_session: AsyncSession):
    unique_ig = f"ig_{uuid.uuid4().hex[:8]}"
    cust, _ = await CustomerService.get_or_create_by_instagram_id(
        db_session, instagram_id=unique_ig, username="client_bob"
    )

    conv, created = await ConversationService.get_or_create_conversation(db_session, customer_id=cust.id)
    assert conv.mode == "ai"
    assert conv.status == "open"

    # Human takeover
    updated_conv = await ConversationService.set_mode(
        db_session, conversation_id=conv.id, mode="human", reason="Client requested human consultant"
    )
    assert updated_conv.mode == "human"


@pytest.mark.asyncio
async def test_message_idempotency(db_session: AsyncSession):
    """Verify Meta webhook duplicate events do not create duplicate messages."""
    unique_ig = f"ig_{uuid.uuid4().hex[:8]}"
    cust, _ = await CustomerService.get_or_create_by_instagram_id(
        db_session, instagram_id=unique_ig, username="client_charlie"
    )
    conv, _ = await ConversationService.get_or_create_conversation(db_session, customer_id=cust.id)

    external_id = f"meta_msg_{uuid.uuid4().hex}"

    # First delivery
    msg1, is_new1 = await ConversationService.record_message(
        db=db_session,
        conversation_id=conv.id,
        customer_id=cust.id,
        channel="instagram",
        direction="inbound",
        sender_type="customer",
        text="Здравствуйте, хочу записаться на консультацию",
        external_message_id=external_id,
    )
    assert is_new1 is True
    assert msg1.id is not None
    assert msg1.text == "Здравствуйте, хочу записаться на консультацию"

    # Duplicate delivery from Meta
    msg2, is_new2 = await ConversationService.record_message(
        db=db_session,
        conversation_id=conv.id,
        customer_id=cust.id,
        channel="instagram",
        direction="inbound",
        sender_type="customer",
        text="Здравствуйте, хочу записаться на консультацию",
        external_message_id=external_id,
    )
    assert is_new2 is False
    assert msg2.id == msg1.id  # Same message returned without duplicate row


@pytest.mark.asyncio
async def test_service_catalog_and_booking_lifecycle(db_session: AsyncSession):
    unique_ig = f"ig_{uuid.uuid4().hex[:8]}"
    # Seed and list services
    await ServiceCatalogService.seed_default_services(db_session)
    services = await ServiceCatalogService.list_services(db_session)
    assert len(services) >= 3
    selected_service = services[0]

    cust, _ = await CustomerService.get_or_create_by_instagram_id(
        db_session, instagram_id=unique_ig, username="client_dan"
    )

    # Create draft booking
    booking_data = BookingCreate(
        customer_id=cust.id,
        service_id=selected_service.id,
        scheduled_at=datetime.now(timezone.utc),
        duration_minutes=selected_service.duration_minutes,
        meeting_type="online",
        customer_phone="+996555123456",
        notes="Первичный разбор бизнеса",
    )
    booking = await BookingService.create_booking(db_session, booking_data, status="draft")
    assert booking.status == "draft"
    assert booking.service_name_snapshot == selected_service.name
    assert booking.price_snapshot == selected_service.price
    assert booking.booking_number.startswith("B-")

    # Confirm booking
    confirmed_booking = await BookingService.confirm_booking(db_session, booking.id)
    assert confirmed_booking.status == "confirmed"
    assert confirmed_booking.confirmed_at is not None
