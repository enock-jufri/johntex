import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { Skeleton } from '@/components/ui/skeleton';

const ProductionEntry = lazy(() => import('./pages/ProductionEntry'));
const AdvanceRequest = lazy(() => import('./pages/AdvanceRequest'));
const PendingApprovals = lazy(() => import('./pages/PendingApprovals'));
const PayrollRun = lazy(() => import('./pages/PayrollRun'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const Settings = lazy(() => import('./pages/Settings'));
const Analytics = lazy(() => import('./pages/Analytics'));
const WorkersPage = lazy(() => import('./pages/WorkersPage'));
const WorkerDetail = lazy(() => import('./pages/WorkerDetail'));

function PageLoader() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

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
        <Route path="/production" element={<Suspense fallback={<PageLoader />}><ProductionEntry /></Suspense>} />
        <Route path="/advances" element={<Suspense fallback={<PageLoader />}><AdvanceRequest /></Suspense>} />
        <Route path="/approvals" element={<Suspense fallback={<PageLoader />}><PendingApprovals /></Suspense>} />
        <Route path="/payroll" element={<ProtectedRoute minRole="admin"><Suspense fallback={<PageLoader />}><PayrollRun /></Suspense></ProtectedRoute>} />
        <Route path="/workers" element={<Suspense fallback={<PageLoader />}><WorkersPage /></Suspense>} />
        <Route path="/workers/:workerId" element={<Suspense fallback={<PageLoader />}><WorkerDetail /></Suspense>} />
        <Route path="/analytics" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageLoader />}><Analytics /></Suspense></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageLoader />}><AuditLog /></Suspense></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute minRole="supervisor"><Suspense fallback={<PageLoader />}><Settings /></Suspense></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
