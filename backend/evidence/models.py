"""Evidence documents and normalized facts with citations."""
from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class EvidenceDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referral = models.ForeignKey(
        "referrals.ReferralCase",
        on_delete=models.CASCADE,
        related_name="evidence_documents",
    )
    original_filename = models.CharField(max_length=255)
    stored_filename = models.CharField(max_length=255)
    safe_file_path = models.CharField(max_length=512)
    mime_type = models.CharField(max_length=128)
    checksum_sha256 = models.CharField(max_length=64)
    size_bytes = models.PositiveIntegerField()
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="uploaded_evidence",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class EvidenceFact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referral = models.ForeignKey(
        "referrals.ReferralCase",
        on_delete=models.CASCADE,
        related_name="evidence_facts",
    )
    document = models.ForeignKey(
        EvidenceDocument,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="facts",
    )
    fact_key = models.CharField(max_length=128)
    value = models.TextField()
    observed_at = models.DateTimeField(null=True, blank=True)
    confidence = models.FloatField(default=1.0)
    source_citation = models.CharField(
        max_length=512,
        help_text="Exact source citation required for every fact.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["fact_key", "created_at"]
