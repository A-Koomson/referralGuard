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

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8">Loading session…</p>;
  if (!user) return <Navigate to="/login" replace />;
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
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<AdminOverviewPage />} />
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
