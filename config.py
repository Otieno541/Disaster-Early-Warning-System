import os
from dotenv import load_dotenv
load_dotenv()
class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dews-kenya-riat-secret-key-2026-change-in-production')
    ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
    OPENWEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', '')
    SMTP_SERVER = os.environ.get('SMTP_SERVER', '')
    SMTP_PORT = int(os.environ.get('SMTP_PORT', 587))
    SMTP_USER = os.environ.get('SMTP_USER', '')
    SMTP_PASSWORD = os.environ.get('SMTP_PASSWORD', '')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
    PERMANENT_SESSION_LIFETIME = 86400
    KENYA_BOUNDS = {
        'min_lat': -5.0,
        'max_lat': 5.0,
        'min_lon': 33.0,
        'max_lon': 43.0
    }