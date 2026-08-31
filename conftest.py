"""Shared pytest fixtures — isolated DB via pytest-django; load root .env for config."""
from __future__ import annotations

from pathlib import Path

import pytest
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env", override=False)


@pytest.fixture
def api_client():
    from rest_framework.test import APIClient

    return APIClient()
