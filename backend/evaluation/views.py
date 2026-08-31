from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsSuperAdmin
from evaluation.models import EvaluationRun


class EvaluationRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = EvaluationRun
        fields = [
            "id",
            "method",
            "mode",
            "provider",
            "model_name",
            "case_count",
            "status",
            "summary",
            "result_paths",
            "not_run_reason",
            "created_at",
            "finished_at",
        ]


class EvaluationRunListView(APIView):
    permission_classes = [IsSuperAdmin]

    def get(self, request):
        qs = EvaluationRun.objects.all()[:50]
        return Response(EvaluationRunSerializer(qs, many=True).data)
