import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';

const roleRank: Record<string, number> = { clerk: 1, supervisor: 2, admin: 3 };

export default function ProtectedRoute({
  children,
  minRole = 'clerk',
}: {
  children: ReactNode;
  minRole?: 'clerk' | 'supervisor' | 'admin';
}) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  const userRank = roleRank[user?.role ?? ''] ?? 0;
  if (userRank < roleRank[minRole]) return <Navigate to="/" replace />;
  return <>{children}</>;
}
