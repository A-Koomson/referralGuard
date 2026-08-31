"""Evidence upload with validation."""
from __future__ import annotations

import hashlib
import json
import uuid
from pathlib import Path

from django.conf import settings
from django.utils.text import get_valid_filename
from rest_framework import serializers, status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from accounts.permissions import HasReferralObjectAccess, IsClinician
from referrals.models import AuditEvent, ClinicianApproval, ReferralCase

from .models import EvidenceDocument, EvidenceFact


class UploadThrottle(UserRateThrottle):
    rate = "30/min"


class EvidenceDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvidenceDocument
        fields = [
            "id",
            "referral",
            "original_filename",
            "stored_filename",
            "mime_type",
            "checksum_sha256",
            "size_bytes",
            "uploaded_by",
            "created_at",
        ]
        read_only_fields = fields


class EvidenceFactSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvidenceFact
        fields = [
            "id",
            "referral",
            "document",
            "fact_key",
            "value",
            "observed_at",
            "confidence",
            "source_citation",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


def _accessible_referral_ids(user):
    from django.db.models import Q

    qs = ReferralCase.objects.all()
    if user.is_super_admin:
        return qs.values_list("id", flat=True)
    filters = Q(created_by=user)
    if user.facility_id:
        filters |= Q(creating_facility_id=user.facility_id)
        filters |= Q(facility_matches__facility_id=user.facility_id)
        filters |= Q(acceptances__facility_id=user.facility_id)
    return qs.filter(filters).distinct().values_list("id", flat=True)


def _validate_parseable_payload(upload, content_type: str) -> str | None:
    """
    Return error message if parse fails; None if stored OK.
    OCR / handwriting are NOT supported — binary images/PDFs are stored only.
    """
    if upload.size == 0:
        return "Empty uploads are rejected."

    if content_type == "application/json":
        raw = upload.read()
        upload.seek(0)
        try:
            json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            return f"JSON parse failed: {exc}. Upload was rejected (not stored as success)."
        return None

    if content_type in {"text/plain", "text/csv"}:
        raw = upload.read()
        upload.seek(0)
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            return f"Text decode failed: {exc}. Upload was rejected."
        if not text.strip():
            return "Text/CSV content is blank after decode."
        return None

    # PDF / images: no OCR — stored as unparsed binary evidence only
    return None


class EvidenceUploadViewSet(viewsets.ViewSet):
    permission_classes = [IsClinician]
    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [UploadThrottle]

    def create(self, request):
        referral_id = request.data.get("referral")
        upload = request.FILES.get("file")
        if not referral_id or not upload:
            return Response(
                {
                    "error": {
                        "code": "validation_error",
                        "message": "referral and file are required",
                        "status": 400,
                    }
                },
                status=400,
            )
        try:
            referral = ReferralCase.objects.get(pk=referral_id)
        except ReferralCase.DoesNotExist:
            return Response(
                {"error": {"code": "not_found", "message": "Referral not found", "status": 404}},
                status=404,
            )
        if not HasReferralObjectAccess().has_object_permission(request, self, referral):
            return Response(
                {"error": {"code": "permission_denied", "message": "Denied", "status": 403}},
                status=403,
            )

        if upload.size > settings.MAX_UPLOAD_BYTES:
            return Response(
                {
                    "error": {
                        "code": "file_too_large",
                        "message": f"Max size {settings.MAX_UPLOAD_BYTES} bytes",
                        "status": 400,
                    }
                },
                status=400,
            )

        content_type = upload.content_type or "application/octet-stream"
        if content_type not in settings.ALLOWED_UPLOAD_CONTENT_TYPES:
            return Response(
                {
                    "error": {
                        "code": "invalid_file_type",
                        "message": (
                            f"Content type {content_type} not allowed. "
                            "Supported: PDF, JPEG, PNG, plain text, CSV, JSON. "
                            "Handwriting OCR is not implemented."
                        ),
                        "status": 400,
                    }
                },
                status=400,
            )

        original = get_valid_filename(upload.name)[:200]
        lower = original.lower()
        if any(lower.endswith(ext) for ext in (".exe", ".bat", ".cmd", ".sh", ".ps1", ".js", ".msi")):
            return Response(
                {
                    "error": {
                        "code": "executable_rejected",
                        "message": "Executable uploads are not allowed",
                        "status": 400,
                    }
                },
                status=400,
            )

        parse_error = _validate_parseable_payload(upload, content_type)
        if parse_error:
            return Response(
                {
                    "error": {
                        "code": "parse_failed",
                        "message": parse_error,
                        "status": 400,
                    }
                },
                status=400,
            )

        stored = f"{uuid.uuid4().hex}_{original}"
        dest_dir = Path(settings.MEDIA_ROOT) / "evidence" / str(referral.id)
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / stored

        hasher = hashlib.sha256()
        with dest.open("wb") as out:
            for chunk in upload.chunks():
                hasher.update(chunk)
                out.write(chunk)

        doc = EvidenceDocument.objects.create(
            referral=referral,
            original_filename=original,
            stored_filename=stored,
            safe_file_path=str(dest.relative_to(settings.MEDIA_ROOT)),
            mime_type=content_type,
            checksum_sha256=hasher.hexdigest(),
            size_bytes=upload.size,
            uploaded_by=request.user,
        )

        # New evidence invalidates prior verified label and clinician approval
        was_verified = referral.fully_verified
        referral.fully_verified = False
        referral.save(update_fields=["fully_verified", "updated_at"])
        deleted_approvals, _ = ClinicianApproval.objects.filter(referral=referral).delete()
        AuditEvent.objects.create(
            actor=request.user,
            action="evidence.upload",
            object_type="EvidenceDocument",
            object_id=str(doc.id),
            before_summary=f"fully_verified={was_verified}",
            after_summary=(
                f"file={original}; approvals_cleared={deleted_approvals}; "
                f"ocr=not_implemented; mime={content_type}"
            ),
            ip_address=request.META.get("REMOTE_ADDR"),
        )

        return Response(
            {
                **EvidenceDocumentSerializer(doc).data,
                "analysis_invalidated": True,
                "ocr_supported": False,
                "note": (
                    "Upload stored. Prior fully-verified label and clinician approvals cleared. "
                    "Re-run analysis after reviewing new evidence. "
                    "PDF/image OCR and handwriting recognition are not implemented."
                ),
            },
            status=status.HTTP_201_CREATED,
        )

    def list(self, request):
        referral_id = request.query_params.get("referral")
        allowed = list(_accessible_referral_ids(request.user))
        qs = EvidenceDocument.objects.filter(referral_id__in=allowed)
        if referral_id:
            if referral_id not in {str(x) for x in allowed}:
                return Response(
                    {
                        "error": {
                            "code": "permission_denied",
                            "message": "Denied",
                            "status": 403,
                        }
                    },
                    status=403,
                )
            qs = qs.filter(referral_id=referral_id)
        return Response(EvidenceDocumentSerializer(qs[:100], many=True).data)
