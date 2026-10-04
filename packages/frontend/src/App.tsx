import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { useI18n } from "./i18n";
import { Spinner } from "./components/shared/Spinner";
import { AppShell } from "./components/layout/AppShell";
import { AuthLayout } from "./components/layout/AuthLayout";
import { Dashboard } from "./components/dashboard";
import { Incidents } from "./components/incidents";
import { Team } from "./components/team";
import { Sites } from "./components/sites";
import { MapPage } from "./components/map";
import { ProfilePage } from "./components/profile/ProfilePage";
import { SettingsPage } from "./components/settings/SettingsPage";
import { setTokenResolver } from "./api/client";
import { AuthGuard } from "./components/auth/AuthGuard";
import { PublicRoute } from "./components/auth/PublicRoute";
import { LoginPage } from "./components/auth/LoginPage";
import { RegisterPage } from "./components/auth/RegisterPage";
import { InviteAcceptancePage } from "./components/auth/InviteAcceptancePage";

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { orgRole } = useAuth();
  if (orgRole !== "org:admin") return <Navigate to="/" />;
  return <>{children}</>;
}

function OperationalRoute({ children }: { children: React.ReactNode }) {
  const { orgRole } = useAuth();
  if (orgRole !== "org:admin" && orgRole !== "org:member") return <Navigate to="/" />;
  return <>{children}</>;
}

export default function App() {
  const { isLoaded, getToken } = useAuth();
  const locale = useI18n((s) => s.locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (isLoaded) {
      setTokenResolver(() => getToken());
    }
  }, [isLoaded, getToken]);

  if (!isLoaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login/*" element={<AuthLayout><LoginPage /></AuthLayout>} />
        <Route path="/register/*" element={<AuthLayout><RegisterPage /></AuthLayout>} />
        <Route path="/invite/*" element={<AuthLayout><InviteAcceptancePage /></AuthLayout>} />
      </Route>
      
      <Route element={<AuthGuard />}>
        <Route
          path="/*"
          element={
            <AppShell>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/incidents" element={<Incidents />} />
                <Route path="/map" element={<OperationalRoute><MapPage /></OperationalRoute>} />
                <Route path="/team" element={<AdminRoute><Team /></AdminRoute>} />
                <Route path="/sites" element={<AdminRoute><Sites /></AdminRoute>} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </AppShell>
          }
        />
      </Route>
    </Routes>
  );
}
