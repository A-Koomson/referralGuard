from django.contrib import admin

from .models import AgentRun, AgentTraceEvent


class TraceInline(admin.TabularInline):
    model = AgentTraceEvent
    extra = 0
    readonly_fields = ("sequence", "tool_or_action", "created_at")


@admin.register(AgentRun)
class AgentRunAdmin(admin.ModelAdmin):
    list_display = (
        "referral",
        "pipeline_stage",
        "provider",
        "status",
        "is_mock",
        "is_replay",
        "created_at",
    )
    list_filter = ("status", "provider", "is_mock", "pipeline_stage")
    readonly_fields = ("id", "created_at", "started_at", "finished_at")
    inlines = [TraceInline]


@admin.register(AgentTraceEvent)
class AgentTraceEventAdmin(admin.ModelAdmin):
    list_display = ("run", "sequence", "tool_or_action", "is_retry", "human_checkpoint")
    readonly_fields = ("id", "created_at")
