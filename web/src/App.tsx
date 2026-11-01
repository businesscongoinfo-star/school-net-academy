import { Suspense, lazy } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { AppShell } from './components/layout';
import { Logo } from './components/logo';
import { PageSkeleton } from './components/ui';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Students = lazy(() => import('./pages/Students').then((module) => ({ default: module.Students })));
const Classes = lazy(() => import('./pages/Classes').then((module) => ({ default: module.Classes })));
const Teachers = lazy(() => import('./pages/Teachers').then((module) => ({ default: module.Teachers })));
const Admissions = lazy(() => import('./pages/Admissions').then((module) => ({ default: module.Admissions })));
const Payments = lazy(() => import('./pages/Payments').then((module) => ({ default: module.Payments })));
const Courses = lazy(() => import('./pages/Courses').then((module) => ({ default: module.Courses })));
const Announcements = lazy(() => import('./pages/Announcements').then((module) => ({ default: module.Announcements })));
const Results = lazy(() => import('./pages/Results').then((module) => ({ default: module.Results })));
const Settings = lazy(() => import('./pages/Settings').then((module) => ({ default: module.Settings })));
const Faculties = lazy(() => import('./pages/Faculties').then((module) => ({ default: module.Faculties })));
const Programs = lazy(() => import('./pages/Programs').then((module) => ({ default: module.Programs })));
const Units = lazy(() => import('./pages/Units').then((module) => ({ default: module.Units })));
const Timetable = lazy(() => import('./pages/Timetable').then((module) => ({ default: module.Timetable })));
const LibraryPage = lazy(() => import('./pages/Library').then((module) => ({ default: module.Library })));
const Attendance = lazy(() => import('./pages/Attendance').then((module) => ({ default: module.Attendance })));
const NotFound = lazy(() => import('./pages/NotFound').then((module) => ({ default: module.NotFound })));

function Splash() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--canvas)' }}>
      <div className="stack gap-16" style={{ alignItems: 'center' }}>
        <div className="row gap-10">
          <Logo />
        </div>
        <span className="spinner" style={{ color: 'var(--primary)', width: 22, height: 22 }} />
        <span className="small muted">Chargement de votre espace…</span>
      </div>
    </div>
  );
}

const page = (element: ReactNode) => <Suspense fallback={<PageSkeleton />}>{element}</Suspense>;

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/connexion" replace />;
  return <>{children}</>;
}

function RoleGate({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  if (!roles.includes(user.role)) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/connexion" element={<Login />} />

      <Route
        path="/app"
        element={(
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        )}
      >
        <Route index element={page(<Dashboard />)} />
        <Route path="eleves" element={page(<RoleGate roles={['admin', 'teacher']}><Students /></RoleGate>)} />
        <Route path="mes-enfants" element={page(<RoleGate roles={['parent']}><Students /></RoleGate>)} />
        <Route path="classes" element={page(<RoleGate roles={['admin', 'teacher']}><Classes /></RoleGate>)} />
        <Route path="enseignants" element={page(<RoleGate roles={['admin']}><Teachers /></RoleGate>)} />
        <Route path="inscriptions" element={page(<RoleGate roles={['admin']}><Admissions /></RoleGate>)} />
        <Route path="paiements" element={page(<RoleGate roles={['admin', 'parent']}><Payments /></RoleGate>)} />
        <Route path="resultats" element={page(<RoleGate roles={['admin', 'teacher', 'parent']}><Results /></RoleGate>)} />
        <Route path="cours" element={page(<RoleGate roles={['admin', 'teacher']}><Courses /></RoleGate>)} />
        <Route path="annonces" element={page(<RoleGate roles={['admin', 'teacher', 'parent']}><Announcements /></RoleGate>)} />
        <Route path="facultes" element={page(<RoleGate roles={['admin', 'teacher']}><Faculties /></RoleGate>)} />
        <Route path="filieres" element={page(<RoleGate roles={['admin', 'teacher']}><Programs /></RoleGate>)} />
        <Route path="unites" element={page(<RoleGate roles={['admin', 'teacher']}><Units /></RoleGate>)} />
        <Route path="emploi-du-temps" element={page(<RoleGate roles={['admin', 'teacher']}><Timetable /></RoleGate>)} />
        <Route path="bibliotheque" element={page(<RoleGate roles={['admin']}><LibraryPage /></RoleGate>)} />
        <Route path="presences" element={page(<RoleGate roles={['admin', 'teacher']}><Attendance /></RoleGate>)} />
        <Route path="parametres" element={page(<Settings />)} />
      </Route>

      <Route path="*" element={<Suspense fallback={<Splash />}><NotFound /></Suspense>} />
    </Routes>
  );
}
