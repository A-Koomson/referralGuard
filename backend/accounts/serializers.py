"""DRF serializers for auth and profile."""
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    facility_name = serializers.CharField(source="facility.name", read_only=True, default=None)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "role",
            "facility",
            "facility_name",
            "is_active",
            "date_joined",
        ]
        read_only_fields = fields


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, style={"input_type": "password"})
