"""API workflow gate tests — approval and acceptance ordering."""
from __future__ import annotations

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Role, User
from facilities.models import Facility, FacilityType
from referrals.models import (
    ClinicianApproval,
    FacilityMatch,
    ReferralCase,
    ReferralStatus,
)


@pytest.fixture
def facility(db):
    return Facility.objects.create(
        name="Workflow Test Hospital",
        facility_type=FacilityType.DISTRICT_HOSPITAL,
        district="Demo",
        region="Demo",
        latitude=5.6,
        longitude=-0.2,
        is_fictional=True,
    )


@pytest.fixture
def receiving(db):
    return Facility.objects.create(
        name="Receiving Hospital",
        facility_type=FacilityType.REGIONAL_HOSPITAL,
        district="Demo",
        region="Demo",
        latitude=5.7,
        longitude=-0.1,
        is_fictional=True,
    )


@pytest.fixture
def clinician(db, facility):
    return User.objects.create_user(
        email="wf-clin@referralguard.local",
        password="test-pass-not-for-prod",
        full_name="Workflow Clinician",
        role=Role.CLINICIAN,
        facility=facility,
    )


@pytest.fixture
def referral(db, facility, clinician):
    return ReferralCase.objects.create(
        synthetic_case_id="RG-WF-001",
        creating_facility=facility,
        created_by=clinician,
        status=ReferralStatus.READY_FOR_MATCHING,
        urgency="EMERGENCY",
        referral_reason="Synthetic emergency referral",
        clinician_confirmed_needs=["OB_CLINICIAN"],
        patient_display_label="Synthetic patient",
    )


@pytest.mark.django_db
def test_approve_rejected_before_matching(referral, clinician):
    client = APIClient()
    client.force_authenticate(user=clinician)
    res = client.post(f"/api/v1/referrals/{referral.id}/approve/", {}, format="json")
    assert res.status_code == 400
    assert "facility matching" in str(res.data).lower()


@pytest.mark.django_db
def test_approve_allowed_after_matching(referral, clinician, receiving):
    referral.transition_to(ReferralStatus.AWAITING_ACCEPTANCE, actor=clinician)
    FacilityMatch.objects.create(
        referral=referral,
        facility=receiving,
        capability_coverage={"OB_CLINICIAN": {"present": True, "fresh": True}},
        distance_km=12.0,
        availability_freshness="fresh",
        explanation="Synthetic",
        rank=1,
    )
    client = APIClient()
    client.force_authenticate(user=clinician)
    res = client.post(f"/api/v1/referrals/{referral.id}/approve/", {}, format="json")
    assert res.status_code == 201
    referral.refresh_from_db()
    assert referral.fully_verified is True


@pytest.mark.django_db
def test_accept_rejected_without_clinician_approval(referral, clinician, receiving):
    referral.transition_to(ReferralStatus.AWAITING_ACCEPTANCE, actor=clinician)
    FacilityMatch.objects.create(
        referral=referral,
        facility=receiving,
        capability_coverage={"OB_CLINICIAN": {"present": True, "fresh": True}},
        distance_km=12.0,
        availability_freshness="fresh",
        explanation="Synthetic",
        rank=1,
    )
    client = APIClient()
    client.force_authenticate(user=clinician)
    res = client.post(
        f"/api/v1/referrals/{referral.id}/accept/",
        {
            "facility": str(receiving.id),
            "decision": "ACCEPTED",
            "reference": "SIM-TEST",
            "instructions": "Synthetic",
        },
        format="json",
    )
    assert res.status_code == 400
    assert "clinician approval" in str(res.data).lower()


@pytest.mark.django_db
def test_accept_allowed_after_approval(referral, clinician, receiving):
    referral.transition_to(ReferralStatus.AWAITING_ACCEPTANCE, actor=clinician)
    FacilityMatch.objects.create(
        referral=referral,
        facility=receiving,
        capability_coverage={"OB_CLINICIAN": {"present": True, "fresh": True}},
        distance_km=12.0,
        availability_freshness="fresh",
        explanation="Synthetic",
        rank=1,
    )
    ClinicianApproval.objects.create(
        referral=referral,
        approved_by=clinician,
        approved_at=timezone.now(),
        workflow_version_at_approval=referral.workflow_version,
    )
    referral.fully_verified = True
    referral.save(update_fields=["fully_verified"])
    client = APIClient()
    client.force_authenticate(user=clinician)
    res = client.post(
        f"/api/v1/referrals/{referral.id}/accept/",
        {
            "facility": str(receiving.id),
            "decision": "ACCEPTED",
            "reference": "SIM-TEST",
            "instructions": "Synthetic",
        },
        format="json",
    )
    assert res.status_code == 201
    referral.refresh_from_db()
    assert referral.status == ReferralStatus.ACCEPTED
