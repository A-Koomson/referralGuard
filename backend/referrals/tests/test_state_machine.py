"""State machine tests for ReferralCase transitions."""
from __future__ import annotations

import pytest

from accounts.models import Role, User
from config.exceptions import InvalidStateTransition
from facilities.models import Facility, FacilityType
from referrals.models import ALLOWED_TRANSITIONS, ReferralCase, ReferralStatus


@pytest.fixture
def facility(db):
    return Facility.objects.create(
        name="Synthetic District Hospital A",
        facility_type=FacilityType.DISTRICT_HOSPITAL,
        district="Demo District",
        region="Demo Region",
        latitude=5.6,
        longitude=-0.2,
        is_fictional=True,
    )


@pytest.fixture
def clinician(db, facility):
    return User.objects.create_user(
        email="clinician@referralguard.local",
        password="test-pass-not-for-prod",
        full_name="Demo Clinician",
        role=Role.CLINICIAN,
        facility=facility,
    )


@pytest.fixture
def referral(db, facility, clinician):
    return ReferralCase.objects.create(
        synthetic_case_id="RG-TEST-001",
        creating_facility=facility,
        created_by=clinician,
        status=ReferralStatus.DRAFT,
        urgency="EMERGENCY",
        referral_reason="Synthetic postpartum haemorrhage",
    )


@pytest.mark.django_db
def test_allowed_draft_to_analysing(referral, clinician):
    referral.transition_to(ReferralStatus.ANALYSING, actor=clinician)
    assert referral.status == ReferralStatus.ANALYSING
    assert referral.workflow_version == 2


@pytest.mark.django_db
def test_invalid_transition_raises(referral):
    with pytest.raises(InvalidStateTransition) as exc:
        referral.transition_to(ReferralStatus.ACCEPTED)
    assert exc.value.from_status == ReferralStatus.DRAFT
    assert exc.value.to_status == ReferralStatus.ACCEPTED


@pytest.mark.django_db
def test_analysing_may_skip_to_ready(referral, clinician):
    referral.transition_to(ReferralStatus.ANALYSING, actor=clinician)
    referral.transition_to(ReferralStatus.READY_FOR_MATCHING, actor=clinician, note="no blocking findings")
    assert referral.status == ReferralStatus.READY_FOR_MATCHING


@pytest.mark.django_db
def test_conditional_transition_optimistic_lock(referral, clinician):
    referral.transition_to(ReferralStatus.ANALYSING, actor=clinician)
    version = referral.workflow_version
    ok = referral.conditional_transition(
        expected_version=version,
        expected_status=ReferralStatus.ANALYSING,
        new_status=ReferralStatus.READY_FOR_MATCHING,
        actor=clinician,
    )
    assert ok is True
    # Stale version must not apply
    ok2 = referral.conditional_transition(
        expected_version=version,
        expected_status=ReferralStatus.ANALYSING,
        new_status=ReferralStatus.NEEDS_CLARIFICATION,
        actor=clinician,
    )
    assert ok2 is False
    referral.refresh_from_db()
    assert referral.status == ReferralStatus.READY_FOR_MATCHING


@pytest.mark.django_db
def test_all_terminal_edges_documented():
    assert ReferralStatus.CLOSED in ALLOWED_TRANSITIONS
    assert ALLOWED_TRANSITIONS[ReferralStatus.CLOSED] == set()
    # Every non-closed status has at least one outbound edge
    for status, targets in ALLOWED_TRANSITIONS.items():
        if status != ReferralStatus.CLOSED:
            assert targets, f"{status} has no transitions"
