from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api import checks, dashboard, admin, master
from app.db.base import Base
from app.db.session import engine
from sqlalchemy import text
import os
import logging

logger = logging.getLogger(__name__)

# Run migrations (safe to run multiple times)
def run_auto_migrations():
    """Add missing columns on startup in a cross-platform way"""
    from app.db.session import SessionLocal
    from sqlalchemy import inspect
    db = SessionLocal()
    try:
        inspector = inspect(engine)
        columns = [c["name"] for c in inspector.get_columns("toilet_checks")]
        
        # Add major_checkpoint_id column if not exists
        if "major_checkpoint_id" not in columns:
            try:
                # SQLite doesn't support IF NOT EXISTS in ALTER TABLE
                db.execute(text("""
                    ALTER TABLE toilet_checks 
                    ADD COLUMN major_checkpoint_id INTEGER 
                    REFERENCES major_checkpoints(id)
                """))
                db.commit()
                logger.info("Migration: major_checkpoint_id column added")
            except Exception as e:
                db.rollback()
                logger.error(f"Migration error adding major_checkpoint_id: {e}")
        
        # Make staff_id nullable (SQLite doesn't support ALTER COLUMN DROP NOT NULL easily,
        # but SQLAlchemy's create_all should handle the schema if it's a fresh DB.
        # For existing Postgres DBs, we try the ALTER command)
        if engine.dialect.name == "postgresql":
            try:
                db.execute(text("ALTER TABLE toilet_checks ALTER COLUMN staff_id DROP NOT NULL"))
                db.commit()
                logger.info("Migration: staff_id nullable OK (PostgreSQL)")
            except Exception as e:
                db.rollback()
                logger.debug(f"Migration: staff_id nullable already set or error: {e}")
                
    except Exception as e:
        logger.error(f"Migration runner error: {e}")
    finally:
        db.close()

# Create tables and run migrations only if not in test mode
if os.getenv("TEST_MODE") != "1":
    Base.metadata.create_all(bind=engine)
    run_auto_migrations()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS
origins = [
    "http://localhost:3000", # Next.js local
    "https://kj-toilet-frontend.onrender.com", # Production Frontend
    "https://kj-toilet-backend.onrender.com", # Production Backend (Self)
    "*" # Allow all for now for PWA/easy dev
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Files (Images)
os.makedirs(settings.IMAGE_STORAGE_PATH, exist_ok=True)
app.mount("/images", StaticFiles(directory=settings.IMAGE_STORAGE_PATH), name="images")

# Include Routers
app.include_router(checks.router, prefix=f"{settings.API_V1_STR}/checks", tags=["checks"])
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["dashboard"])
app.include_router(admin.router, prefix=f"{settings.API_V1_STR}/admin", tags=["admin"])
app.include_router(master.router, prefix=f"{settings.API_V1_STR}", tags=["master"]) # /api/toilets, /api/staff

@app.get("/")
def root():
    return {"message": "KJ-Toilet-Cheker API is running"}
