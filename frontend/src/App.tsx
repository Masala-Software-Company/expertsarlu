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
import { InboxPage } from '@/features/inbox/InboxPage';
import { SignerPage } from '@/features/facturation/SignerPage';
import { VersionChecker } from '@/components/VersionChecker';
import { CommandPalette } from '@/components/CommandPalette';

const SPLASH_KEY = 'expert-splash-done';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
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
          <Route path="dossiers" element={<DossiersPage />} />
          <Route path="dossiers/:id" element={<DossierDetailPage />} />
          <Route path="prospects" element={<ProspectsPage />} />
          <Route path="partenaires" element={<PartenairesPage />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="logistique" element={<LogistiquePage />} />
          <Route path="tarification" element={<TarificationPage />} />
          <Route path="corbeille" element={<CorbeillePage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="profil" element={<ProfilePage />} />
          <Route path="utilisateurs" element={<Navigate to="/equipe" replace />} />
          <Route path="equipe" element={<UsersPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CommandPalette />
    </>
  );
}
