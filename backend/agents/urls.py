from django.urls import path
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsSuperAdmin
from agents.models import AgentRun
from agents.serializers import AgentRunSerializer
from evaluation.models import EvaluationRun
from facilities.models import Facility
from referrals.models import ReferralCase


class AgentRunListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        referral_id = request.query_params.get("referral")
        qs = AgentRun.objects.all().order_by("-created_at")
        if referral_id:
            qs = qs.filter(referral_id=referral_id)
        return Response(AgentRunSerializer(qs[:50], many=True).data)


class AgentRunDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, run_id):
        try:
            run = AgentRun.objects.prefetch_related("trace_events").get(pk=run_id)
        except AgentRun.DoesNotExist:
            return Response(
                {
                    "error": {
                        "code": "not_found",
                        "message": "Run not found",
                        "status": 404,
                    }
                },
                status=404,
            )
        return Response(AgentRunSerializer(run).data)


class AdminOverviewView(APIView):
    """Custom admin overview — authenticated users (hackathon visibility)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "referral_cases": ReferralCase.objects.count(),
                "facilities": Facility.objects.filter(is_active=True).count(),
                "users": User.objects.filter(is_active=True).count(),
                "agent_runs": AgentRun.objects.count(),
                "agent_succeeded": AgentRun.objects.filter(status="SUCCEEDED").count(),
                "agent_failed": AgentRun.objects.filter(status="FAILED").count(),
                "mock_runs": AgentRun.objects.filter(is_mock=True).count(),
                "live_runs": AgentRun.objects.filter(
                    is_mock=False, is_replay=False
                ).count(),
                "evaluation_runs": EvaluationRun.objects.count(),
                "disclaimer": (
                    "Hackathon prototype — synthetic data — not for clinical use."
                ),
            }
        )


class AdminAgentStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "total_runs": AgentRun.objects.count(),
                "succeeded": AgentRun.objects.filter(status="SUCCEEDED").count(),
                "failed": AgentRun.objects.filter(status="FAILED").count(),
                "mock_runs": AgentRun.objects.filter(is_mock=True).count(),
                "live_runs": AgentRun.objects.filter(
                    is_mock=False, is_replay=False
                ).count(),
            }
        )


class AdminUserListView(APIView):
    """Read-only user list for super-admins. Mutations use Django Admin (audited)."""

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        users = User.objects.select_related("facility").order_by("email")[:100]
        return Response(
            [
                {
                    "id": str(u.id),
                    "email": u.email,
                    "full_name": u.full_name,
                    "role": u.role,
                    "facility_name": u.facility.name if u.facility_id else None,
                    "is_active": u.is_active,
                    "is_staff": u.is_staff,
                    "note": (
                        "Create/update/deactivate users via Django Admin. "
                        "QUALIFIED_REVIEWER is a demo label, not professional qualification."
                    ),
                }
                for u in users
            ]
        )


urlpatterns = [
    path("agent-runs/", AgentRunListView.as_view(), name="agent-runs"),
    path(
        "agent-runs/<uuid:run_id>/",
        AgentRunDetailView.as_view(),
        name="agent-run-detail",
    ),
    path("admin/overview/", AdminOverviewView.as_view(), name="admin-overview"),
    path("admin/agent-stats/", AdminAgentStatsView.as_view(), name="admin-agent-stats"),
    path("admin/users/", AdminUserListView.as_view(), name="admin-users"),
]
