"""URL configuration for ReferralGuard."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

admin.site.site_header = "ReferralGuard Admin"
admin.site.site_title = "ReferralGuard"
admin.site.index_title = "Operations (synthetic data — not for clinical use)"

FRONTEND_ORIGIN = "http://127.0.0.1:5173"


def health(_request):
    return JsonResponse(
        {
            "status": "ok",
            "service": "referralguard",
            "disclaimer": getattr(
                settings,
                "DISCLAIMER",
                "Hackathon prototype — synthetic data — not for clinical use.",
            ),
        }
    )


def spa_hint(_request, path: str = ""):
    """UI routes belong to Vite (:5173), not Django (:8000)."""
    target = f"{FRONTEND_ORIGIN}/{path}" if path else FRONTEND_ORIGIN
    if settings.DEBUG:
        return redirect(target)
    return HttpResponse(
        (
            "<h1>ReferralGuard UI</h1>"
            "<p>This path is served by the frontend (Vite), not Django.</p>"
            f'<p>Open <a href="{target}">{target}</a></p>'
        ),
        status=404,
        content_type="text/html",
    )


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health, name="health"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/schema/swagger-ui/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/v1/", include("config.api_urls")),
    path("admin-dashboard/", spa_hint, {"path": "admin-dashboard"}),
    path("admin-dashboard", spa_hint, {"path": "admin-dashboard"}),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
