import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db, engine, Base, AsyncSessionLocal
import app.models  # Register all models
from app.services.service_catalog import ServiceCatalogService
from app.services.user_service import UserService

from app.api.routes.auth import router as auth_router
from app.api.routes.webhooks import router as webhook_router

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("insta.app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager: connects to DB, creates tables, seeds defaults."""
    logger.info("Starting up %s in %s mode...", settings.APP_NAME, settings.ENVIRONMENT)
    try:
        # Create tables on startup in development
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables initialized successfully.")

        # Seed default consulting services & default admin
        async with AsyncSessionLocal() as session:
            seeded_services = await ServiceCatalogService.seed_default_services(session)
            if seeded_services:
                logger.info("Seeded %d default consulting services.", len(seeded_services))

            seeded_admin = await UserService.seed_initial_admin(session)
            if seeded_admin:
                logger.info("Seeded initial administrator account: %s", seeded_admin.email)

    except Exception as exc:
        logger.error("Failed to initialize database on startup: %s", exc)

    yield

    logger.info("Shutting down %s...", settings.APP_NAME)
    await engine.dispose()
    logger.info("Database connection pool disposed.")


app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    description="AI-Powered Customer Management & Consultation Booking Platform",
    lifespan=lifespan,
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router)
app.include_router(webhook_router)

from app.api.routes.conversations import router as conversations_router
from app.api.routes.customers import router as customers_router
from app.api.routes.bookings import router as bookings_router
from app.api.routes.services import router as services_router
from app.api.routes.dashboard import router as dashboard_router


app.include_router(conversations_router)
app.include_router(customers_router)
app.include_router(bookings_router)
app.include_router(services_router)
app.include_router(dashboard_router)



@app.get("/api/health", status_code=status.HTTP_200_OK, tags=["Health"])
async def health_check(db: AsyncSession = Depends(get_db)):
    """Health check endpoint: checks application and database liveness."""
    try:
        result = await db.execute(text("SELECT 1"))
        db_ok = result.scalar() == 1
    except Exception as exc:
        logger.error("Health check database query failed: %s", exc)
        db_ok = False

    return {
        "status": "healthy" if db_ok else "degraded",
        "app": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
        "database": "connected" if db_ok else "disconnected",
    }


@app.get("/", tags=["Root"])
async def root():
    return {
        "app": settings.APP_NAME,
        "version": "0.1.0",
        "docs_url": "/docs",
    }


@app.get("/privacy", tags=["Legal"])
async def privacy_policy():
    """Privacy Policy page required by Meta for Live App mode."""
    from fastapi.responses import HTMLResponse
    content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Privacy Policy - INSTA CRM</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #222; }
            h1 { color: #111; border-bottom: 2px solid #eee; padding-bottom: 10px; }
            h2 { color: #333; margin-top: 30px; }
            p, li { color: #444; }
        </style>
    </head>
    <body>
        <h1>Privacy Policy for INSTA CRM</h1>
        <p><strong>Effective Date:</strong> October 7, 2026</p>
        <p>INSTA CRM ("we", "our", or "us") provides an AI-powered customer service and consultation booking automation service for Instagram. We respect your privacy and are committed to protecting personal data.</p>
        
        <h2>1. Information We Collect</h2>
        <p>When you interact with our service via Instagram Direct Messages, we may receive:</p>
        <ul>
            <li>Your Instagram user scoped ID (IGSID) and public profile name.</li>
            <li>Messages and inquiries sent by you to our automated assistant.</li>
            <li>Consultation scheduling details (such as your chosen appointment date, service, name, and contact details).</li>
        </ul>

        <h2>2. How We Use Information</h2>
        <p>We use the collected information solely to:</p>
        <ul>
            <li>Respond automatically to customer inquiries regarding consulting services.</li>
            <li>Book, schedule, and confirm consultation appointments.</li>
            <li>Allow human customer support agents to assist you when requested.</li>
        </ul>

        <h2>3. Data Sharing and Protection</h2>
        <p>We do not sell, rent, or trade your personal information. Your data is securely stored in encrypted databases and is only accessible to authorized team members.</p>

        <h2>4. User Rights and Data Deletion</h2>
        <p>You have the right to request the deletion of your personal data at any time. To request deletion of your conversation history or booking details, please contact us at: <strong>privacy@instacrm.local</strong> or by sending a message stating "Удалить мои данные" in Instagram Direct. Your data will be deleted within 24 hours.</p>

        <h2>5. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact: <strong>support@instacrm.local</strong>.</p>
    </body>
    </html>
    """
    return HTMLResponse(content=content)


@app.get("/terms", tags=["Legal"])
async def terms_of_service():
    """Terms of Service page for INSTA CRM."""
    from fastapi.responses import HTMLResponse
    content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Terms of Service - INSTA CRM</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #222; }
            h1 { color: #111; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        </style>
    </head>
    <body>
        <h1>Terms of Service for INSTA CRM</h1>
        <p><strong>Effective Date:</strong> October 7, 2026</p>
        <p>By using INSTA CRM services via Instagram Direct Messages, you agree to these Terms of Service.</p>
        <p>Our service provides consultation information, automated booking, and support assistance. We reserve the right to modify or discontinue services with reasonable notice.</p>
        <p>Contact: <strong>support@instacrm.local</strong></p>
    </body>
    </html>
    """
    return HTMLResponse(content=content)

