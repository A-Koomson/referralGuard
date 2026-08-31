"""Evaluation run metadata (results files live under evaluation/results/)."""
from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class EvaluationRun(models.Model):
    class Mode(models.TextChoices):
        MOCK = "mock", "Mock (not an AI benchmark)"
        LIVE = "live", "Live LLM"
        REPLAY = "replay", "Replay stored real-run artifacts"

    class Method(models.TextChoices):
        BASELINE = "baseline", "Baseline direct prompt"
        AGENT = "agent", "Final agent pipeline"
        ABLATION = "ablation", "Ablation"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    method = models.CharField(max_length=32, choices=Method.choices)
    mode = models.CharField(max_length=16, choices=Mode.choices)
    provider = models.CharField(max_length=64, blank=True)
    model_name = models.CharField(max_length=128, blank=True)
    case_count = models.PositiveSmallIntegerField(default=12)
    status = models.CharField(max_length=32, default="PENDING")
    summary = models.JSONField(default=dict)
    result_paths = models.JSONField(default=dict)
    not_run_reason = models.TextField(
        blank=True,
        help_text="If live comparison was not executed, state blocker clearly.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
