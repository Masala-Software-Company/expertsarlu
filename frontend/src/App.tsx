import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/auth-store';
import { LoginPage } from '@/features/auth/LoginPage';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { DossiersPage } from '@/features/dossiers/DossiersPage';
import { DossierDetailPage } from '@/features/dossiers/DossierDetailPage';
import { TarificationPage } from '@/features/tarification/TarificationPage';
import { CorbeillePage } from '@/features/corbeille/CorbeillePage';
import { ProspectsPage } from '@/features/prospects/ProspectsPage';
import { LogistiquePage } from '@/features/logistique/LogistiquePage';
import { AuditPage } from '@/features/audit/AuditPage';
import { VersionChecker } from '@/components/VersionChecker';
import { CommandPalette } from '@/components/CommandPalette';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <VersionChecker />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
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
          <Route path="logistique" element={<LogistiquePage />} />
          <Route path="tarification" element={<TarificationPage />} />
          <Route path="corbeille" element={<CorbeillePage />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CommandPalette />
    </>
  );
}
