"""Tests for evaluation benchmark admin API."""
from __future__ import annotations

import pytest
from rest_framework.test import APIClient

from accounts.models import Role, User


@pytest.fixture
def super_admin(db):
    return User.objects.create_superuser(
        email="admin_eval@referralguard.local",
        password="test-pass-not-for-prod",
        full_name="Eval Admin",
        role=Role.SUPER_ADMIN,
    )


@pytest.fixture
def authed_client(super_admin):
    client = APIClient()
    client.force_authenticate(user=super_admin)
    return client


@pytest.mark.django_db
def test_benchmark_endpoint(authed_client):
    res = authed_client.get("/api/v1/evaluation/benchmark/")
    assert res.status_code == 200
    assert "run_status" in res.data
    assert "artifacts" in res.data


@pytest.mark.django_db
def test_run_endpoint_starts_mock_eval(authed_client):
    res = authed_client.post(
        "/api/v1/evaluation/run/",
        {"method": "agent", "mode": "mock"},
        format="json",
    )
    assert res.status_code == 202
    assert res.data["status"] == "started"


@pytest.mark.django_db
def test_run_status_endpoint(authed_client):
    res = authed_client.get("/api/v1/evaluation/run/status/")
    assert res.status_code == 200
    assert "running" in res.data
