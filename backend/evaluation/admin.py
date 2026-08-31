from django.contrib import admin

from .models import EvaluationRun


@admin.register(EvaluationRun)
class EvaluationRunAdmin(admin.ModelAdmin):
    list_display = ("method", "mode", "status", "case_count", "created_at")
    list_filter = ("method", "mode", "status")
    readonly_fields = ("id", "created_at", "finished_at")
