import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/auth/AuthContext";
import { AppShell } from "@/components/AppShell";
import { AvailabilityPage } from "@/pages/AvailabilityPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { FacilitiesPage } from "@/pages/FacilitiesPage";
import { FacilityDetailPage } from "@/pages/FacilityDetailPage";
import { HandoffPage } from "@/pages/HandoffPage";
import { LoginPage } from "@/pages/LoginPage";
import { NewReferralPage } from "@/pages/NewReferralPage";
import { PrintSummaryPage } from "@/pages/PrintSummaryPage";
import { ReferralDetailPage } from "@/pages/ReferralDetailPage";
import { AdminAgentsPage } from "@/pages/admin/AdminAgentsPage";
import { AdminEvaluationPage } from "@/pages/admin/AdminEvaluationPage";
import { AdminFacilitiesPage } from "@/pages/admin/AdminFacilitiesPage";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import { AdminOverviewPage } from "@/pages/admin/AdminOverviewPage";
import { AdminReferralsPage } from "@/pages/admin/AdminReferralsPage";
import { AdminSettingsPage } from "@/pages/admin/AdminSettingsPage";
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function SessionLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 rg-page-enter">
      <div className="rg-loading-mark" aria-hidden>
        RG
      </div>
      <p className="text-sm text-rg-muted">Loading session…</p>
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <SessionLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <SessionLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "SUPER_ADMIN" && !user.email?.includes("admin@")) {
    return (
      <div className="rg-panel p-6">
        <h1 className="text-lg font-semibold">Admin access required</h1>
        <p className="text-sm text-rg-muted mt-2">
          Super-administrator access is required for this area.
        </p>
      </div>
    );
  }
  return children;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <PrivateRoute>
                  <AppShell />
                </PrivateRoute>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              <Route path="/referrals/new" element={<NewReferralPage />} />
              <Route path="/referrals/:id" element={<ReferralDetailPage />} />
              <Route path="/referrals/:id/handoff" element={<HandoffPage />} />
              <Route path="/referrals/:id/print" element={<PrintSummaryPage />} />
              <Route path="/facilities" element={<FacilitiesPage />} />
              <Route path="/facilities/:id" element={<FacilityDetailPage />} />
              <Route path="/availability" element={<AvailabilityPage />} />
              <Route
                path="/admin"
                element={
                  <SuperAdminRoute>
                    <AdminLayout />
                  </SuperAdminRoute>
                }
              >
                <Route index element={<AdminOverviewPage />} />
                <Route path="evaluation" element={<AdminEvaluationPage />} />
                <Route path="referrals" element={<AdminReferralsPage />} />
                <Route path="facilities" element={<AdminFacilitiesPage />} />
                <Route path="agents" element={<AdminAgentsPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="settings" element={<AdminSettingsPage />} />
              </Route>
              <Route path="/admin-dashboard" element={<Navigate to="/admin" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
