from django.utils import timezone
from rest_framework import mixins, permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import IsAuthenticatedReadOrCoordinatorWrite

from .models import AvailabilityUpdate, Capability, Facility, FacilityCapability
from .serializers import (
    AvailabilityUpdateSerializer,
    CapabilitySerializer,
    FacilitySerializer,
)


class FacilityViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Facility.objects.filter(is_active=True).prefetch_related(
        "facility_capabilities__capability"
    )
    serializer_class = FacilitySerializer
    search_fields = ["name", "district", "region"]
    filterset_fields = ["facility_type", "region", "district"]


class CapabilityViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Capability.objects.all()
    serializer_class = CapabilitySerializer
    search_fields = ["code", "name"]


class AvailabilityUpdateViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    queryset = AvailabilityUpdate.objects.select_related(
        "facility_capability__facility",
        "facility_capability__capability",
        "confirmed_by",
    )
    serializer_class = AvailabilityUpdateSerializer
    permission_classes = [IsAuthenticatedReadOrCoordinatorWrite]

    def perform_create(self, serializer):
        update = serializer.save(
            confirmed_by=self.request.user,
            confirmed_at=timezone.now(),
        )
        fc = update.facility_capability
        fc.availability_state = update.state
        fc.save(update_fields=["availability_state", "updated_at"])

    @action(
        detail=False,
        methods=["get"],
        url_path="console",
        permission_classes=[permissions.IsAuthenticated],
    )
    def console(self, request):
        """Service-level availability console — readable by any authenticated user."""
        qs = FacilityCapability.objects.select_related("facility", "capability").filter(
            facility__is_active=True
        )
        # Coordinators default to their facility unless super-admin
        if (
            request.user.role == "FACILITY_COORDINATOR"
            and request.user.facility_id
            and not request.user.is_super_admin
            and request.query_params.get("all") != "1"
        ):
            qs = qs.filter(facility_id=request.user.facility_id)

        rows = []
        for fc in qs:
            latest = fc.availability_updates.order_by("-confirmed_at").first()
            rows.append(
                {
                    "facility_id": str(fc.facility_id),
                    "facility_name": fc.facility.name,
                    "capability_code": fc.capability.code,
                    "capability_name": fc.capability.name,
                    "state": fc.availability_state,
                    "latest_update": (
                        AvailabilityUpdateSerializer(latest).data if latest else None
                    ),
                }
            )
        return Response(
            {
                "disclaimer": (
                    "Synthetic service-level availability only — not real hospital capacity."
                ),
                "can_update": request.user.role
                in {"FACILITY_COORDINATOR", "SUPER_ADMIN"}
                or request.user.is_super_admin,
                "rows": rows,
            }
        )
