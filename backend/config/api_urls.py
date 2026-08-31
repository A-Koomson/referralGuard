"""Versioned API v1 route includes."""
from django.urls import include, path

urlpatterns = [
    path("auth/", include("accounts.urls")),
    path("", include("facilities.urls")),
    path("", include("referrals.urls")),
    path("", include("evidence.urls")),
    path("", include("agents.urls")),
    path("evaluation/", include("evaluation.urls")),
]
