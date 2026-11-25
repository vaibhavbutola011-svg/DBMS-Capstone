"""Application configuration. All secrets come from environment variables / .env."""
import os
from pathlib import Path

from dotenv import load_dotenv

# backend/.env  (two levels up from this file)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class Config:
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = int(os.getenv("DB_PORT", "3306"))
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "student_academic_db")

    SECRET_KEY = os.getenv("SECRET_KEY", "dev-only-secret-change-me-before-deploying-1234")
    JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "8"))

    CORS_ORIGINS = [o.strip() for o in os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]

    DEBUG = os.getenv("FLASK_DEBUG", "0") == "1"
    PORT = int(os.getenv("PORT", "5000"))

    # Password given to accounts the admin creates without typing a password
    DEFAULT_STUDENT_PASSWORD = os.getenv("DEFAULT_STUDENT_PASSWORD", "Student@123")
    DEFAULT_FACULTY_PASSWORD = os.getenv("DEFAULT_FACULTY_PASSWORD", "Faculty@123")
