from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate


class CustomerService:
    @staticmethod
    async def get_by_id(db: AsyncSession, customer_id: int) -> Optional[Customer]:
        result = await db.execute(select(Customer).where(Customer.id == customer_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_instagram_id(db: AsyncSession, instagram_id: str) -> Optional[Customer]:
        result = await db.execute(select(Customer).where(Customer.instagram_id == instagram_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def get_or_create_by_instagram_id(
        db: AsyncSession,
        instagram_id: str,
        username: Optional[str] = None,
        name: Optional[str] = None,
    ) -> tuple[Customer, bool]:
        """Returns (customer, created). Updates last_contact_at."""
        customer = await CustomerService.get_by_instagram_id(db, instagram_id)
        created = False
        now = datetime.now(timezone.utc)

        if customer:
            # Update username/name if newly provided
            if username and not customer.username:
                customer.username = username
            if name and not customer.name:
                customer.name = name
            customer.last_contact_at = now
            await db.commit()
            await db.refresh(customer)
        else:
            customer = Customer(
                instagram_id=instagram_id,
                username=username,
                name=name or username or f"IG-{instagram_id[-6:]}",
                last_contact_at=now,
            )
            db.add(customer)
            await db.commit()
            await db.refresh(customer)
            created = True

        return customer, created

    @staticmethod
    async def get_by_whatsapp_id(db: AsyncSession, whatsapp_id: str) -> Optional[Customer]:
        clean_raw = whatsapp_id.replace("+", "").replace(" ", "").replace("-", "")
        clean_no_lid = clean_raw.replace("@lid", "")
        candidates = [whatsapp_id, clean_raw, clean_no_lid]
        result = await db.execute(
            select(Customer).where(
                or_(
                    Customer.whatsapp_id.in_(candidates),
                    Customer.phone.in_([c for c in candidates] + [f"+{c}" for c in candidates])
                )
            )
        )
        return result.scalars().first()

    @staticmethod
    async def get_or_create_by_whatsapp_id(
        db: AsyncSession,
        whatsapp_id: str,
        phone: Optional[str] = None,
        name: Optional[str] = None,
    ) -> tuple[Customer, bool]:
        """Returns (customer, created). Updates last_contact_at."""
        customer = await CustomerService.get_by_whatsapp_id(db, whatsapp_id)
        if not customer and phone:
            customer = await CustomerService.get_by_whatsapp_id(db, phone)

        created = False
        now = datetime.now(timezone.utc)

        target_wa_id = whatsapp_id.replace("+", "").strip()
        display_phone = (phone or whatsapp_id).replace("@lid", "").replace("+", "").strip()
        formatted_phone = f"+{display_phone}" if display_phone else None

        if customer:
            if name and (not customer.name or customer.name.startswith("WA-") or customer.name.startswith("WhatsApp ")):
                customer.name = name
            if not customer.whatsapp_id or "@lid" in target_wa_id:
                customer.whatsapp_id = target_wa_id
            if not customer.phone and formatted_phone:
                customer.phone = formatted_phone
            customer.last_contact_at = now
            await db.commit()
            await db.refresh(customer)
        else:
            customer = Customer(
                whatsapp_id=target_wa_id,
                phone=formatted_phone,
                name=name or f"WhatsApp {display_phone[-4:] if display_phone else 'User'}",
                last_contact_at=now,
            )
            db.add(customer)
            await db.commit()
            await db.refresh(customer)
            created = True

        return customer, created

    @staticmethod
    async def update(db: AsyncSession, customer_id: int, data: CustomerUpdate) -> Optional[Customer]:
        customer = await CustomerService.get_by_id(db, customer_id)
        if not customer:
            return None

        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(customer, key, value)

        await db.commit()
        await db.refresh(customer)
        return customer

    @staticmethod
    async def list_customers(
        db: AsyncSession,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Customer]:
        query = select(Customer)
        if search:
            search_filter = f"%{search}%"
            query = query.where(
                or_(
                    Customer.name.ilike(search_filter),
                    Customer.username.ilike(search_filter),
                    Customer.phone.ilike(search_filter),
                    Customer.email.ilike(search_filter),
                )
            )
        query = query.order_by(Customer.last_contact_at.desc().nullslast()).offset(skip).limit(limit)
        result = await db.execute(query)
        return list(result.scalars().all())
