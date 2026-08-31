"""Synthetic facilities, capabilities, and time-stamped availability."""
from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class FacilityType(models.TextChoices):
    HEALTH_CENTRE = "HEALTH_CENTRE", "Health centre"
    DISTRICT_HOSPITAL = "DISTRICT_HOSPITAL", "District hospital"
    REGIONAL_HOSPITAL = "REGIONAL_HOSPITAL", "Regional hospital"
    TEACHING_HOSPITAL = "TEACHING_HOSPITAL", "Teaching hospital"


class AvailabilityState(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Available"
    LIMITED = "LIMITED", "Limited"
    UNAVAILABLE = "UNAVAILABLE", "Unavailable"
    UNKNOWN = "UNKNOWN", "Unknown"


class Facility(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    facility_type = models.CharField(max_length=32, choices=FacilityType.choices)
    district = models.CharField(max_length=128)
    region = models.CharField(max_length=128)
    latitude = models.FloatField(help_text="Synthetic coordinate only")
    longitude = models.FloatField(help_text="Synthetic coordinate only")
    phone_placeholder = models.CharField(max_length=64, default="+233-000-000-000")
    is_active = models.BooleanField(default=True)
    is_fictional = models.BooleanField(
        default=True,
        help_text="All seeded facilities are explicitly fictional.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "facilities"

    def __str__(self) -> str:
        return self.name


class Capability(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["code"]
        verbose_name_plural = "capabilities"

    def __str__(self) -> str:
        return f"{self.code}: {self.name}"


class FacilityCapability(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    facility = models.ForeignKey(
        Facility, on_delete=models.CASCADE, related_name="facility_capabilities"
    )
    capability = models.ForeignKey(
        Capability, on_delete=models.CASCADE, related_name="facility_links"
    )
    availability_state = models.CharField(
        max_length=16,
        choices=AvailabilityState.choices,
        default=AvailabilityState.UNKNOWN,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("facility", "capability")
        verbose_name_plural = "facility capabilities"

    def __str__(self) -> str:
        return f"{self.facility.name} — {self.capability.code}"


class AvailabilityUpdate(models.Model):
    """
    Service-level availability only (e.g. obstetric clinician on duty, theatre,
    blood bank, neonatal support). Never store individual doctor schedules.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    facility_capability = models.ForeignKey(
        FacilityCapability,
        on_delete=models.CASCADE,
        related_name="availability_updates",
    )
    state = models.CharField(max_length=16, choices=AvailabilityState.choices)
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="availability_confirmations",
    )
    confirmed_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-confirmed_at"]

    def __str__(self) -> str:
        return f"{self.facility_capability} [{self.state}]"

    @property
    def is_fresh(self) -> bool:
        return timezone.now() < self.expires_at

    @property
    def freshness_label(self) -> str:
        if self.is_fresh:
            return "fresh"
        return "stale"
