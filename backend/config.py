"""Local development and Render configuration. Never put credentials in source."""
from pathlib import Path
from dotenv import load_dotenv
import os
import secrets

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT.parent / '.env')
PRODUCTION = os.getenv('APP_ENV', 'development').lower() == 'production'
DATA = Path(os.getenv('DATA_DIR', str(ROOT / 'data')))
DATA.mkdir(parents=True, exist_ok=True)
UPLOADS = DATA / 'uploads'
UPLOADS.mkdir(exist_ok=True)
DB_PATH = str(DATA / 'autoprint.sqlite3')
FRONTEND_DIST = ROOT.parent / 'dist' / 'client'
SECRET_KEY = os.getenv('SECRET_KEY', '')
ADMIN_USERNAME = os.getenv('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.getenv('ADMIN_PASSWORD', '')

if PRODUCTION:
    if len(SECRET_KEY) < 32:
        raise RuntimeError('Set SECRET_KEY to at least 32 random characters in Render Environment.')
    if not ADMIN_USERNAME or len(ADMIN_PASSWORD) < 12:
        raise RuntimeError('Set ADMIN_USERNAME and an ADMIN_PASSWORD of at least 12 characters in Render Environment.')
elif not SECRET_KEY:
    secret_file = DATA / 'session-secret'
    if not secret_file.exists():
        secret_file.write_text(secrets.token_hex(32))
    SECRET_KEY = secret_file.read_text()

COOKIE_SECURE = PRODUCTION or os.getenv('COOKIE_SECURE', 'false').lower() == 'true'
DEMO_MODE = os.getenv('DEMO_MODE', 'true').lower() == 'true'
SIMULATION = os.getenv('PRINT_MODE', 'simulation') == 'simulation'
AGENT_TOKEN = os.getenv('PRINT_AGENT_TOKEN', '')
ADMIN_TOKEN = os.getenv('ADMIN_TOKEN', '')
