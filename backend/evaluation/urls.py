from django.urls import path

from .views import EvaluationRunListView

urlpatterns = [
    path("runs/", EvaluationRunListView.as_view(), name="evaluation-runs"),
]
