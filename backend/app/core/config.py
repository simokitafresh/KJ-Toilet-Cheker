from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "KJ-Toilet-Cheker"
    API_V1_STR: str = "/api"
    
    # Database
    DATABASE_URL: str
    
    # Security
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin"
    SECRET_KEY: str = "your-secret-key-here" # Should be changed in production
    ALGORITHM: str = "HS256"
    
    # Storage
    IMAGE_STORAGE_PATH: str = "/var/data/toilet-images"

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()
