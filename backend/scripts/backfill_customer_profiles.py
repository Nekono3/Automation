import asyncio
import logging
from sqlalchemy import select
from app.database import async_session_factory
from app.models.customer import Customer
from app.integrations.instagram.client import InstagramClient
from app.services.deal_service import DealService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("backfill")


async def backfill():
    async with async_session_factory() as db:
        res = await db.execute(select(Customer))
        customers = res.scalars().all()
        logger.info("Found %d customers in database.", len(customers))

        ig_client = InstagramClient()

        for c in customers:
            updated = False
            # 1. Instagram profile enrichment
            if c.instagram_id and (not c.username or (c.name and c.name.startswith("IG-"))):
                try:
                    prof = await ig_client.get_user_profile(c.instagram_id)
                    if prof:
                        if prof.get("username") and not c.username:
                            c.username = prof["username"]
                            updated = True
                        if prof.get("name") and (not c.name or c.name.startswith("IG-")):
                            c.name = prof["name"]
                            updated = True
                        elif prof.get("username") and (not c.name or c.name.startswith("IG-")):
                            c.name = prof["username"]
                            updated = True
                        logger.info("Enriched Instagram customer #%d: name=%s, username=%s", c.id, c.name, c.username)
                except Exception as e:
                    logger.warning("Error fetching profile for customer #%d (%s): %s", c.id, c.instagram_id, e)

            # 2. WhatsApp profile cleanup
            if c.whatsapp_id and c.phone:
                if not c.name or c.name.startswith("WhatsApp ") or c.name.startswith("WA-"):
                    # Keep phone as readable identifier if no name yet
                    pass

            if updated:
                await db.commit()

            # Sync deal titles
            await DealService.sync_customer_deal_title(db, c.id)

        await db.commit()
        logger.info("Backfill completed successfully.")


if __name__ == "__main__":
    asyncio.run(backfill())
