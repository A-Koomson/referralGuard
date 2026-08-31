"""Role and object permission helpers."""
from __future__ import annotations

from rest_framework.permissions import SAFE_METHODS, BasePermission, IsAuthenticated

from .models import Role


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and user.is_super_admin)


class IsClinician(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role
            in {Role.CLINICIAN, Role.QUALIFIED_REVIEWER, Role.SUPER_ADMIN}
        )


class IsReferralParticipant(BasePermission):
    """Clinicians, reviewers, coordinators, and super-admins may access referral APIs."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                user.is_super_admin
                or user.role
                in {
                    Role.CLINICIAN,
                    Role.QUALIFIED_REVIEWER,
                    Role.FACILITY_COORDINATOR,
                    Role.SUPER_ADMIN,
                }
            )
        )


class IsFacilityCoordinator(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and user.role in {Role.FACILITY_COORDINATOR, Role.SUPER_ADMIN}
        )


class IsAuthenticatedReadOrCoordinatorWrite(BasePermission):
    """Authenticated users may read; only coordinators/super-admins may write."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return user.role in {Role.FACILITY_COORDINATOR, Role.SUPER_ADMIN} or user.is_super_admin


class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.is_authenticated and request.user.is_super_admin)


class HasReferralObjectAccess(BasePermission):
    """Object-level access for referral cases (facility-scoped; no global coordinator bypass)."""

    def has_object_permission(self, request, view, obj) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_super_admin:
            return True
        if getattr(obj, "created_by_id", None) == user.id:
            return True
        if getattr(obj, "assigned_reviewer_id", None) == user.id:
            return True
        if hasattr(obj, "creating_facility_id") and user.facility_id:
            if obj.creating_facility_id == user.facility_id:
                return True
            # Receiving facility: matched or accepted at coordinator's site
            if user.role == Role.FACILITY_COORDINATOR:
                if obj.facility_matches.filter(facility_id=user.facility_id).exists():
                    return True
                if obj.acceptances.filter(facility_id=user.facility_id).exists():
                    return True
        return False


# Re-export for convenience
__all__ = [
    "IsSuperAdmin",
    "IsClinician",
    "IsReferralParticipant",
    "IsFacilityCoordinator",
    "IsAuthenticatedReadOrCoordinatorWrite",
    "IsAdminOrReadOnly",
    "HasReferralObjectAccess",
    "IsAuthenticated",
]
