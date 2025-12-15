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

# Create tables
Base.metadata.create_all(bind=engine)

# Run migrations (safe to run multiple times)
def run_auto_migrations():
    """Add missing columns on startup"""
    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        # Add major_checkpoint_id column if not exists
        db.execute(text("""
            ALTER TABLE toilet_checks 
            ADD COLUMN IF NOT EXISTS major_checkpoint_id INTEGER 
            REFERENCES major_checkpoints(id)
        """))
        db.commit()
        logger.info("Migration: major_checkpoint_id column OK")
        
        # Make staff_id nullable if not already
        db.execute(text("""
            ALTER TABLE toilet_checks 
            ALTER COLUMN staff_id DROP NOT NULL
        """))
        db.commit()
        logger.info("Migration: staff_id nullable OK")
    except Exception as e:
        db.rollback()
        logger.info(f"Migration: {e} (may already be applied)")
    finally:
        db.close()

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
