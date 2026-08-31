"""Agent run and trace persistence (observable actions only — no hidden CoT)."""
from __future__ import annotations

import uuid

from django.db import models


class AgentRunStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    RUNNING = "RUNNING", "Running"
    SUCCEEDED = "SUCCEEDED", "Succeeded"
    FAILED = "FAILED", "Failed"
    NEEDS_HUMAN = "NEEDS_HUMAN", "Needs human checkpoint"


class AgentRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referral = models.ForeignKey(
        "referrals.ReferralCase",
        on_delete=models.CASCADE,
        related_name="agent_runs",
    )
    pipeline_stage = models.CharField(max_length=64)
    provider = models.CharField(max_length=64)
    model_name = models.CharField(max_length=128, blank=True)
    prompt_version = models.CharField(max_length=64, default="v1")
    status = models.CharField(
        max_length=16, choices=AgentRunStatus.choices, default=AgentRunStatus.PENDING
    )
    latency_ms = models.PositiveIntegerField(null=True, blank=True)
    estimated_cost_usd = models.DecimalField(
        max_digits=10, decimal_places=6, null=True, blank=True
    )
    input_hash = models.CharField(max_length=64, blank=True)
    error_summary = models.TextField(blank=True)
    is_mock = models.BooleanField(default=True)
    is_replay = models.BooleanField(default=False)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class AgentTraceEvent(models.Model):
    """Concise observable actions suitable for trajectories — never hidden CoT."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    run = models.ForeignKey(AgentRun, on_delete=models.CASCADE, related_name="trace_events")
    sequence = models.PositiveIntegerField()
    instruction_summary = models.TextField()
    tool_or_action = models.CharField(max_length=128)
    sanitized_input = models.JSONField(default=dict)
    output_summary = models.TextField(blank=True)
    is_retry = models.BooleanField(default=False)
    human_feedback = models.TextField(blank=True)
    human_checkpoint = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["sequence"]
        unique_together = ("run", "sequence")
