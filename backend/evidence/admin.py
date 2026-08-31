from django.contrib import admin

from .models import EvidenceDocument, EvidenceFact


@admin.register(EvidenceDocument)
class EvidenceDocumentAdmin(admin.ModelAdmin):
    list_display = ("original_filename", "referral", "mime_type", "uploaded_by", "created_at")
    search_fields = ("original_filename", "stored_filename", "checksum_sha256")
    readonly_fields = ("id", "checksum_sha256", "stored_filename", "safe_file_path", "created_at")


@admin.register(EvidenceFact)
class EvidenceFactAdmin(admin.ModelAdmin):
    list_display = ("fact_key", "referral", "confidence", "created_at")
    search_fields = ("fact_key", "value", "source_citation")
    readonly_fields = ("id", "created_at")
