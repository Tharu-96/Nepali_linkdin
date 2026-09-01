from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from dotenv import load_dotenv
from sqlalchemy import inspect, text
load_dotenv()

from app.core.config import settings
from app.core.database import Base, engine

# Explicitly import all models so Base.metadata.create_all() sees every table
from app.models import user, payment  # noqa: F401
from app.models.review import Review  # noqa: F401
from app.models.password_reset_token import PasswordResetToken  # noqa: F401


from app.api.endpoints import (
    auth, users, profiles, reports, admin,
    jobs, applications, chat, calls, chatbot, payments, maps, reviews, notifications
)

# =========================
# DB INIT (OK for dev only)
# =========================
Base.metadata.create_all(bind=engine)

# Compatibility fix for older databases missing columns added after first boot.
def ensure_compatibility_columns() -> None:
    with engine.begin() as conn:
        inspector = inspect(conn)
        table_names = set(inspector.get_table_names())

        if "users" in table_names:
            user_columns = {col["name"] for col in inspector.get_columns("users")}
            if "phone_number" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN phone_number VARCHAR"))
            if "national_id_card" not in user_columns:
                conn.execute(text("ALTER TABLE users ADD COLUMN national_id_card VARCHAR"))

        if "applications" in table_names:
            application_columns = {col["name"] for col in inspector.get_columns("applications")}
            for column_name, column_type in (
                ("full_name", "VARCHAR"),
                ("professional_headline", "VARCHAR"),
                ("skills", "TEXT"),
                ("proposal_pitch", "TEXT"),
            ):
                if column_name not in application_columns:
                    conn.execute(text(f"ALTER TABLE applications ADD COLUMN {column_name} {column_type}"))

ensure_compatibility_columns()

app = FastAPI(
    title="Rozgar API",
    description="Full-stack Web Application Backend",
    version="1.0.0"
)

os.makedirs("static/uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# =========================
# ENVIRONMENT DEPLOYMENT CHECK
# =========================
@app.on_event("startup")
def check_environment_variables():
    """Validates optional platform service keys on boot."""
    if not os.environ.get("GROQ_API_KEY"):
        print("\n" + "="*60)
        print("WARNING: 'GROQ_API_KEY' is missing from environment variables!")
        print("Search enhancement and assistant responses will use basic fallbacks.")
        print("="*60 + "\n")
    else:
        print("\nOptional search and assistant service configured.\n")

# =========================
# CORS & WEBSOCKET ORIGINS MATCH (FIXED)
# =========================
# Local development origins (Vite may pick 5173/5174/5175).
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
]

# Production origins come from the environment so the deployed frontend can
# talk to this API. FRONTEND_BASE_URL is a single URL; CORS_ALLOW_ORIGINS is an
# optional comma-separated list for additional domains.
_frontend_base_url = os.environ.get("FRONTEND_BASE_URL", "").strip()
if _frontend_base_url and _frontend_base_url not in origins:
    origins.append(_frontend_base_url.rstrip("/"))

for extra_origin in os.environ.get("CORS_ALLOW_ORIGINS", "").split(","):
    cleaned = extra_origin.strip().rstrip("/")
    if cleaned and cleaned not in origins:
        origins.append(cleaned)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# ROUTERS
# =========================
app.include_router(auth.router, prefix="/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/users", tags=["Users"])
app.include_router(profiles.router, prefix="/profiles", tags=["Profiles"])
app.include_router(reports.router, prefix="/reports", tags=["Reports"])
app.include_router(admin.router, prefix="/admin", tags=["Admin Management"])
app.include_router(jobs.router, prefix="/jobs", tags=["Jobs"])
app.include_router(applications.router, prefix="/applications", tags=["Applications"])
app.include_router(payments.router, prefix="/payments", tags=["Payments"])
app.include_router(maps.router, prefix="/maps", tags=["Maps"])
app.include_router(reviews.router, prefix="/reviews", tags=["Reviews"])
app.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])

# This router cleanly registers both your HTTP chat actions AND your smart /ws/chat WebSocket endpoint!
app.include_router(chat.router, prefix="/chat", tags=["Chat"])
app.include_router(calls.router, prefix="/calls", tags=["Calls"])
app.include_router(chatbot.router, prefix="/chatbot", tags=["Chatbot"])

# /api aliases keep the frontend on one common API root while preserving the
# existing unprefixed routes used by older code and tests.
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(profiles.router, prefix="/api/profiles", tags=["Profiles"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin Management"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(applications.router, prefix="/api/applications", tags=["Applications"])
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
app.include_router(maps.router, prefix="/api/maps", tags=["Maps"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["Reviews"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(calls.router, prefix="/api/calls", tags=["Calls"])
app.include_router(chatbot.router, prefix="/api/chatbot", tags=["Chatbot"])


@app.websocket("/ws/chat")
async def websocket_chat_alias(websocket: WebSocket):
    """Direct WebSocket alias for clients that do not use the Vite dev proxy."""
    await chat.websocket_endpoint(websocket)

# =========================
# TEST ROOT API (Frontend test)
# =========================
@app.get("/")
def read_root():
    return {
        "message": "Rozgar API Backend Running",
        "status": "online",
        "docs_url": "/docs"
}

