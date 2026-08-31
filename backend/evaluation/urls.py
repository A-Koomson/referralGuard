from django.urls import path

from .benchmark_views import EvaluationBenchmarkView, EvaluationRunStatusView, EvaluationRunView
from .views import EvaluationRunListView

urlpatterns = [
    path("runs/", EvaluationRunListView.as_view(), name="evaluation-runs"),
    path("benchmark/", EvaluationBenchmarkView.as_view(), name="evaluation-benchmark"),
    path("run/status/", EvaluationRunStatusView.as_view(), name="evaluation-run-status"),
    path("run/", EvaluationRunView.as_view(), name="evaluation-run"),
]
