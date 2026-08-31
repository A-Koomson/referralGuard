from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AvailabilityUpdateViewSet, CapabilityViewSet, FacilityViewSet

router = DefaultRouter()
router.register(r"facilities", FacilityViewSet, basename="facility")
router.register(r"capabilities", CapabilityViewSet, basename="capability")
router.register(r"availability", AvailabilityUpdateViewSet, basename="availability")

urlpatterns = [
    path("", include(router.urls)),
]
