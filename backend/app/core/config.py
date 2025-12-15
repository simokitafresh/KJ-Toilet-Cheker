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
    
    # Alert System Settings
    MORNING_CHECK_START: str = "08:00"
    MORNING_CHECK_DEADLINE: str = "08:50"
    AFTERNOON_CHECK_START: str = "14:00"
    AFTERNOON_CHECK_DEADLINE: str = "14:50"
    REGULAR_CHECK_START: str = "08:50"
    REGULAR_CHECK_END: str = "21:00"
    REGULAR_CHECK_INTERVAL_MINUTES: int = 60
    LUNCH_BREAK_START: str = "12:00"
    LUNCH_BREAK_END: str = "14:00"
    
    # Business Hours (F003/F004)
    CLOSED_DAYS: str = "0"  # 0=Sunday, 6=Saturday, comma-separated, empty=no closed days
    BUSINESS_HOURS_START: str = "07:00"
    BUSINESS_HOURS_END: str = "22:00"

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"  # Allow extra env vars like PYTHON_VERSION

settings = Settings()
