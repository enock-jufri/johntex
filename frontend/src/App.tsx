import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { PageShellSkeleton } from '@/components/ui/PageShell';

const ProductionEntry = lazy(() => import('./pages/ProductionEntry'));
const AdvanceRequest = lazy(() => import('./pages/AdvanceRequest'));
const PendingApprovals = lazy(() => import('./pages/PendingApprovals'));
const PayrollRun = lazy(() => import('./pages/PayrollRun'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const Settings = lazy(() => import('./pages/Settings'));
const Analytics = lazy(() => import('./pages/Analytics'));
const WorkersPage = lazy(() => import('./pages/WorkersPage'));
const WorkerDetail = lazy(() => import('./pages/WorkerDetail'));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/production" element={<Suspense fallback={<PageShellSkeleton statCount={5} />}><ProductionEntry /></Suspense>} />
        <Route path="/advances" element={<Suspense fallback={<PageShellSkeleton statCount={4} />}><AdvanceRequest /></Suspense>} />
        <Route path="/approvals" element={<Suspense fallback={<PageShellSkeleton statCount={2} />}><PendingApprovals /></Suspense>} />
        <Route path="/payroll" element={<ProtectedRoute minRole="admin"><Suspense fallback={<PageShellSkeleton statCount={6} />}><PayrollRun /></Suspense></ProtectedRoute>} />
        <Route path="/workers" element={<Suspense fallback={<PageShellSkeleton statCount={5} />}><WorkersPage /></Suspense>} />
        <Route path="/workers/:workerId" element={<Suspense fallback={<PageShellSkeleton statCount={4} />}><WorkerDetail /></Suspense>} />
        <Route path="/analytics" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageShellSkeleton />}><Analytics /></Suspense></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageShellSkeleton statCount={5} />}><AuditLog /></Suspense></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageShellSkeleton />}><Settings /></Suspense></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
