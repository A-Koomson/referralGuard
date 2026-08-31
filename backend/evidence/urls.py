from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import EvidenceUploadViewSet

router = DefaultRouter()
router.register(r"evidence", EvidenceUploadViewSet, basename="evidence")

urlpatterns = [
    path("", include(router.urls)),
]
