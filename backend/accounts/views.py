"""Authentication and profile endpoints."""
from __future__ import annotations

from django.contrib.auth import authenticate, login, logout
from django.middleware.csrf import get_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .serializers import LoginSerializer, UserSerializer


class LoginRateThrottle(AnonRateThrottle):
    rate = "10/min"


class CsrfView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    @method_decorator(ensure_csrf_cookie)
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = authenticate(
            request,
            username=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )
        if user is None or not user.is_active:
            return Response(
                {
                    "error": {
                        "code": "authentication_failed",
                        "message": "Invalid email or password.",
                        "status": 401,
                    }
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )
        login(request, user)
        # Rotate sets a new CSRF secret; expose the matching cookie for the SPA.
        token = get_token(request)
        return Response({"user": UserSerializer(user).data, "csrfToken": token})


class LogoutView(APIView):
    @method_decorator(ensure_csrf_cookie)
    def post(self, request):
        logout(request)
        token = get_token(request)
        return Response({"detail": "Logged out.", "csrfToken": token})


class MeView(APIView):
    def get(self, request):
        return Response(
            {
                "user": UserSerializer(request.user).data,
                "disclaimer": (
                    "Hackathon prototype — synthetic data — not for clinical use. "
                    "Documentation readiness is not medical clearance. "
                    "QUALIFIED_REVIEWER is a role label only, not proof of clinical qualification."
                ),
            }
        )
