from rest_framework import serializers

from .models import AvailabilityUpdate, Capability, Facility, FacilityCapability


class CapabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Capability
        fields = ["id", "code", "name", "description"]


class FacilityCapabilitySerializer(serializers.ModelSerializer):
    capability = CapabilitySerializer(read_only=True)
    capability_id = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = FacilityCapability
        fields = [
            "id",
            "capability",
            "capability_id",
            "availability_state",
            "updated_at",
        ]


class FacilitySerializer(serializers.ModelSerializer):
    capabilities = FacilityCapabilitySerializer(
        source="facility_capabilities", many=True, read_only=True
    )

    class Meta:
        model = Facility
        fields = [
            "id",
            "name",
            "facility_type",
            "district",
            "region",
            "latitude",
            "longitude",
            "phone_placeholder",
            "is_active",
            "is_fictional",
            "capabilities",
        ]


class AvailabilityUpdateSerializer(serializers.ModelSerializer):
    freshness = serializers.CharField(source="freshness_label", read_only=True)
    is_fresh = serializers.BooleanField(read_only=True)

    class Meta:
        model = AvailabilityUpdate
        fields = [
            "id",
            "facility_capability",
            "state",
            "confirmed_by",
            "confirmed_at",
            "expires_at",
            "notes",
            "freshness",
            "is_fresh",
            "created_at",
        ]
        read_only_fields = ["id", "confirmed_by", "confirmed_at", "created_at", "freshness", "is_fresh"]
