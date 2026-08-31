from django.urls import path

from accounts.admin_settings_views import SystemSettingCreateView, SystemSettingsView

from .views import CsrfView, LoginView, LogoutView, MeView

urlpatterns = [
    path("csrf/", CsrfView.as_view(), name="auth-csrf"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", MeView.as_view(), name="auth-me"),
    path("admin/system-settings/", SystemSettingsView.as_view(), name="admin-system-settings"),
    path(
        "admin/system-settings/create/",
        SystemSettingCreateView.as_view(),
        name="admin-system-settings-create",
    ),
]
