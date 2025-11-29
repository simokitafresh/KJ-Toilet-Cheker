from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api import checks, dashboard, admin, master
from app.db.base import Base
from app.db.session import engine
import os

# Create tables
Base.metadata.create_all(bind=engine)

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
