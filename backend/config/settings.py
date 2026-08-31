"""Django settings for ReferralGuard — SQLite, session auth, CSRF."""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent


def _env(key: str, default: str | None = None) -> str | None:
    return os.environ.get(key, default)


def _env_bool(key: str, default: bool = False) -> bool:
    val = os.environ.get(key)
    if val is None:
        return default
    return val.strip().lower() in {"1", "true", "yes", "on"}


def _env_list(key: str, default: str = "") -> list[str]:
    raw = os.environ.get(key, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


SECRET_KEY = _env("DJANGO_SECRET_KEY", "dev-only-insecure-change-me")
DEBUG = _env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = _env_list("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "corsheaders",
    "django_filters",
    "rest_framework",
    "drf_spectacular",
    # Local apps
    "accounts",
    "facilities",
    "referrals",
    "evidence",
    "agents",
    "evaluation",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# SQLite — created automatically by migrate; no server/account required
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
        "OPTIONS": {
            "timeout": 20,
        },
    }
}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Session + CSRF (no tokens in localStorage)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = False  # readable by JS for double-submit header
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_TRUSTED_ORIGINS = _env_list(
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    "http://127.0.0.1:5173,http://localhost:5173",
)

if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True

CORS_ALLOWED_ORIGINS = _env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://127.0.0.1:5173,http://localhost:5173",
)
CORS_ALLOW_CREDENTIALS = True

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "config.exceptions.referralguard_exception_handler",
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/min",
        "user": "120/min",
    },
}

SPECTACULAR_SETTINGS = {
    "TITLE": "ReferralGuard API",
    "DESCRIPTION": (
        "Hackathon prototype — synthetic data — not for clinical use. "
        "Decision-support and documentation verification only."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# LLM / agents
LLM_PROVIDER = _env("LLM_PROVIDER", "mock")
LLM_API_KEY = _env("LLM_API_KEY", "")
LLM_MODEL = _env("LLM_MODEL", "")
LLM_BASE_URL = _env("LLM_BASE_URL", "")
LLM_PRICE_INPUT_PER_1M = _env("LLM_PRICE_INPUT_PER_1M", "")
LLM_PRICE_OUTPUT_PER_1M = _env("LLM_PRICE_OUTPUT_PER_1M", "")

# Bootstrap
BOOTSTRAP_SUPERADMIN_EMAIL = _env(
    "BOOTSTRAP_SUPERADMIN_EMAIL", "admin@referralguard.local"
)
BOOTSTRAP_SUPERADMIN_PASSWORD = _env("BOOTSTRAP_SUPERADMIN_PASSWORD", "")
BOOTSTRAP_ALLOW_GENERATED_PASSWORD = _env_bool(
    "BOOTSTRAP_ALLOW_GENERATED_PASSWORD", True
)
BOOTSTRAP_ALLOW_PRODUCTION = _env_bool("BOOTSTRAP_ALLOW_PRODUCTION", False)

# Upload limits
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
ALLOWED_UPLOAD_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "text/plain",
    "text/csv",
    "application/json",
}

# Paths for synthetic data / evaluation
SYNTHETIC_DATA_DIR = REPO_ROOT / "data" / "synthetic"
EVALUATION_DIR = REPO_ROOT / "evaluation"
TRAJECTORIES_DIR = REPO_ROOT / "trajectories"
POLICY_MANIFEST_PATH = (
    BASE_DIR / "agents" / "policy" / "provisional_checklist_manifest.json"
)

DISCLAIMER = (
    "Hackathon prototype — synthetic data — not for clinical use. "
    "Documentation readiness is not medical clearance."
)
