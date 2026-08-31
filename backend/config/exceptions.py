"""Consistent API error envelopes for ReferralGuard."""
from __future__ import annotations

from typing import Any

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def referralguard_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    response = exception_handler(exc, context)
    if response is None:
        return None

    detail = response.data
    code = getattr(exc, "default_code", None) or getattr(exc, "code", None) or "error"
    if isinstance(detail, dict) and "detail" in detail and len(detail) == 1:
        message = detail["detail"]
        errors = None
    else:
        message = "Request validation failed" if response.status_code == 400 else "Error"
        errors = detail

    payload: dict[str, Any] = {
        "error": {
            "code": str(code),
            "message": str(message) if not isinstance(message, list | dict) else message,
            "status": response.status_code,
        }
    }
    if errors is not None:
        payload["error"]["details"] = errors

    response.data = payload
    return response


class InvalidStateTransition(Exception):
    """Raised when a referral status transition is not allowed."""

    def __init__(self, message: str, *, from_status: str, to_status: str) -> None:
        super().__init__(message)
        self.from_status = from_status
        self.to_status = to_status
        self.default_code = "invalid_state_transition"


def invalid_transition_response(exc: InvalidStateTransition) -> Response:
    return Response(
        {
            "error": {
                "code": "invalid_state_transition",
                "message": str(exc),
                "status": status.HTTP_409_CONFLICT,
                "details": {
                    "from_status": exc.from_status,
                    "to_status": exc.to_status,
                },
            }
        },
        status=status.HTTP_409_CONFLICT,
    )
