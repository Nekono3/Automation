import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db, engine

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("insta.app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager: connects to DB on startup, cleans up on shutdown."""
    logger.info("Starting up %s in %s mode...", settings.APP_NAME, settings.ENVIRONMENT)
    try:
        # Verify database connection
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("Successfully connected to PostgreSQL database.")
    except Exception as exc:
        logger.error("Failed to connect to PostgreSQL database on startup: %s", exc)

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
