from rest_framework import serializers

from .models import AgentRun, AgentTraceEvent


class AgentTraceEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentTraceEvent
        fields = [
            "id",
            "sequence",
            "instruction_summary",
            "tool_or_action",
            "sanitized_input",
            "output_summary",
            "is_retry",
            "human_feedback",
            "human_checkpoint",
            "created_at",
        ]


class AgentRunSerializer(serializers.ModelSerializer):
    trace_events = AgentTraceEventSerializer(many=True, read_only=True)

    class Meta:
        model = AgentRun
        fields = [
            "id",
            "referral",
            "pipeline_stage",
            "provider",
            "model_name",
            "prompt_version",
            "status",
            "latency_ms",
            "estimated_cost_usd",
            "input_hash",
            "error_summary",
            "is_mock",
            "is_replay",
            "started_at",
            "finished_at",
            "created_at",
            "trace_events",
        ]
