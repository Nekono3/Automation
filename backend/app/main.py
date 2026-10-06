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
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router)
app.include_router(webhook_router)


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
