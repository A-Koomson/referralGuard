"""Custom user model and roles for ReferralGuard."""
from __future__ import annotations

import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from .managers import UserManager


class Role(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", "Super admin"
    CLINICIAN = "CLINICIAN", "Clinician"
    FACILITY_COORDINATOR = "FACILITY_COORDINATOR", "Facility coordinator"
    QUALIFIED_REVIEWER = "QUALIFIED_REVIEWER", "Qualified reviewer (role label only)"


class User(AbstractBaseUser, PermissionsMixin):
    """
    Email-based user with facility affiliation and role.

    QUALIFIED_REVIEWER is an application role name only — it is not proof of
    professional clinical qualification. Expert review must be recorded separately
    if obtained; this prototype has not been clinically validated by default.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=32, choices=Role.choices, default=Role.CLINICIAN)
    facility = models.ForeignKey(
        "facilities.Facility",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="users",
    )
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name"]

    class Meta:
        ordering = ["email"]

    def __str__(self) -> str:
        return f"{self.email} ({self.role})"

    @property
    def is_super_admin(self) -> bool:
        return self.role == Role.SUPER_ADMIN or self.is_superuser


class SystemSetting(models.Model):
    """Editable prototype configuration (secrets remain in .env only)."""

    key = models.CharField(max_length=64, unique=True)
    value = models.TextField(blank=True)
    label = models.CharField(max_length=128)
    help_text = models.TextField(blank=True)
    category = models.CharField(max_length=32, default="general")
    is_secret = models.BooleanField(default=False)
    editable = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category", "key"]

    def __str__(self) -> str:
        return self.key
