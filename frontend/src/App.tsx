import { useCallback, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth-store';
import { LoginPage } from '@/features/auth/LoginPage';
import { AppShell } from '@/components/layout/AppShell';
import { SplashIntro } from '@/components/SplashIntro';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { DossiersPage } from '@/features/dossiers/DossiersPage';
import { DossierDetailPage } from '@/features/dossiers/DossierDetailPage';
import { TarificationPage } from '@/features/tarification/TarificationPage';
import { CorbeillePage } from '@/features/corbeille/CorbeillePage';
import { ProspectsPage } from '@/features/prospects/ProspectsPage';
import { LogistiquePage } from '@/features/logistique/LogistiquePage';
import { AuditPage } from '@/features/audit/AuditPage';
import { UsersPage } from '@/features/users/UsersPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { ClientPortalPage } from '@/features/client-portal/ClientPortalPage';
import { SuiviPage } from '@/features/client-portal/SuiviPage';
import { PartenairesPage } from '@/features/partenaires/PartenairesPage';
import { SignerPage } from '@/features/facturation/SignerPage';
import { PreInscriptionsPage } from '@/features/pre-inscriptions/PreInscriptionsPage';
import { VersionChecker } from '@/components/VersionChecker';
import { CommandPalette } from '@/components/CommandPalette';
import { canAccessPath } from '@/lib/role-access';

const SPLASH_KEY = 'expert-splash-done';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Bloque l’accès direct par URL aux modules hors périmètre du rôle. */
function RoleRoute({
  path,
  children,
}: {
  path: string;
  children: React.ReactNode;
}) {
  const user = useAuthStore((s) => s.user);
  if (!canAccessPath(user?.role, path)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function isPublicPath(pathname: string) {
  return (
    pathname === '/login' ||
    pathname === '/portail' ||
    pathname.startsWith('/suivi/') ||
    pathname.startsWith('/signer/')
  );
}

export default function App() {
  const location = useLocation();
  const skipSplash = useMemo(() => isPublicPath(location.pathname), [location.pathname]);
  const [splashDone, setSplashDone] = useState(
    () =>
      skipSplash ||
      (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SPLASH_KEY) === '1'),
  );

  const finishSplash = useCallback(() => {
    sessionStorage.setItem(SPLASH_KEY, '1');
    setSplashDone(true);
  }, []);

  if (!splashDone && !skipSplash) {
    return <SplashIntro onDone={finishSplash} />;
  }

  return (
    <>
      <VersionChecker />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/portail" element={<ClientPortalPage />} />
        <Route path="/suivi/:token" element={<SuiviPage />} />
        <Route path="/signer/:token" element={<SignerPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <AppShell />
            </PrivateRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route
            path="dossiers"
            element={
              <RoleRoute path="/dossiers">
                <DossiersPage />
              </RoleRoute>
            }
          />
          <Route
            path="nouveaux-patients"
            element={
              <RoleRoute path="/nouveaux-patients">
                <PreInscriptionsPage />
              </RoleRoute>
            }
          />
          <Route
            path="dossiers/:id"
            element={
              <RoleRoute path="/dossiers">
                <DossierDetailPage />
              </RoleRoute>
            }
          />
          <Route
            path="prospects"
            element={
              <RoleRoute path="/prospects">
                <ProspectsPage />
              </RoleRoute>
            }
          />
          <Route path="onboarding" element={<Navigate to="/prospects" replace />} />
          <Route
            path="partenaires"
            element={
              <RoleRoute path="/partenaires">
                <PartenairesPage />
              </RoleRoute>
            }
          />
          <Route path="inbox" element={<Navigate to="/prospects?tab=messages" replace />} />
          <Route path="messages" element={<Navigate to="/prospects?tab=messages" replace />} />
          <Route
            path="logistique"
            element={
              <RoleRoute path="/logistique">
                <LogistiquePage />
              </RoleRoute>
            }
          />
          <Route
            path="tarification"
            element={
              <RoleRoute path="/tarification">
                <TarificationPage />
              </RoleRoute>
            }
          />
          <Route
            path="corbeille"
            element={
              <RoleRoute path="/corbeille">
                <CorbeillePage />
              </RoleRoute>
            }
          />
          <Route
            path="audit"
            element={
              <RoleRoute path="/audit">
                <AuditPage />
              </RoleRoute>
            }
          />
          <Route path="profil" element={<ProfilePage />} />
          <Route path="utilisateurs" element={<Navigate to="/equipe" replace />} />
          <Route
            path="equipe"
            element={
              <RoleRoute path="/equipe">
                <UsersPage />
              </RoleRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CommandPalette />
    </>
  );
}
