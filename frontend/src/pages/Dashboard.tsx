import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useWorkers } from '../hooks/useWorkers';
import { useProducts } from '../hooks/useProducts';
import { useProductionLogs } from '../hooks/useProductionLogs';
import { useAdvances } from '../hooks/useAdvances';
import { usePayrolls } from '../hooks/usePayroll';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Users, Scissors, DollarSign, Clock, Shirt,
  TrendingUp, ArrowRight, Wallet, BarChart3, UserPlus, Plus,
} from 'lucide-react';

function resolveName(id: number, items: { id: number; name: string }[] | undefined): string {
  return items?.find((i) => i.id === id)?.name ?? `#${id}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: workers } = useWorkers();
  const { data: products } = useProducts();
  const { data: logs } = useProductionLogs();
  const { data: advances } = useAdvances();
  const { data: payrolls } = usePayrolls();

  const getMonday = (d: Date) => {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    return monday.toISOString().slice(0, 10);
  };
  const weekStart = getMonday(new Date());
  const today = new Date().toISOString().slice(0, 10);

  const weekLogs = logs?.filter((l) => l.production_date >= weekStart) ?? [];
  const weekPieces = weekLogs.reduce((s, l) => s + l.quantity, 0);
  const weekPayrollDue = payrolls
    ?.filter((p) => p.week_start === weekStart)
    .reduce((s, p) => s + p.net_pay, 0) ?? 0;
  const pendingLogs = logs?.filter((l) => !l.approved).length ?? 0;
  const pendingAdvances = advances?.filter((a) => !a.approved).length ?? 0;

  const recent = [...(logs ?? [])].sort((a, b) => b.id - a.id).slice(0, 6);

  const weeklyEarnings = useMemo(() => {
    const map: Record<number, { total: number; daily: Record<string, number> }> = {};
    logs?.forEach((l) => {
      if (l.production_date >= weekStart) {
        if (!map[l.worker_id]) map[l.worker_id] = { total: 0, daily: {} };
        map[l.worker_id].total += l.amount;
        map[l.worker_id].daily[l.production_date] = (map[l.worker_id].daily[l.production_date] || 0) + l.amount;
      }
    });
    return Object.entries(map)
      .map(([wid, data]) => ({ workerId: Number(wid), ...data }))
      .sort((a, b) => b.total - a.total);
  }, [logs, weekStart]);

  const daysOfWeek = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Welcome back, {user?.username}</h2>
        <p className="text-muted-foreground mt-1">
          {today} · <span className="capitalize">{user?.role}</span>
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Active Tailors', value: workers?.filter((w) => w.active).length ?? '-', icon: <Users className="h-5 w-5" /> },
          { label: "This Week's Pieces", value: weekPieces || '-', icon: <Scissors className="h-5 w-5" /> },
          { label: 'Weekly Wages Due', value: `${weekPayrollDue.toLocaleString()} KES`, icon: <Wallet className="h-5 w-5" /> },
          { label: 'Awaiting Approval', value: pendingLogs, icon: <Clock className="h-5 w-5" /> },
          { label: 'Outstanding Advances', value: pendingAdvances, icon: <DollarSign className="h-5 w-5" /> },
          { label: 'Garments', value: products?.length ?? '-', icon: <Shirt className="h-5 w-5" /> },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                <span className="text-muted-foreground/60">{s.icon}</span>
              </div>
              <p className="text-2xl font-bold mt-2">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <Link to="/production" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              View all <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No entries yet.</p>
            ) : (
              recent.map((l) => (
                <div key={l.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <Link to={`/workers/${l.worker_id}`} className="font-medium truncate hover:text-primary hover:underline">{resolveName(l.worker_id, workers)}</Link>
                    <p className="text-xs text-muted-foreground">
                      {resolveName(l.product_id, products)} · {l.quantity} pcs · {l.amount.toFixed(0)} KES
                    </p>
                  </div>
                  <Badge variant={l.approved ? 'default' : 'secondary'} className="text-xs">
                    {l.approved ? 'Approved' : 'Pending'}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {[
              { to: '/production', label: 'Log Production', icon: <Scissors className="h-4 w-4" />, roles: ['clerk', 'supervisor', 'admin'] },
              { to: '/advances', label: 'Request Advance', icon: <DollarSign className="h-4 w-4" />, roles: ['clerk', 'supervisor', 'admin'] },
              { to: '/approvals', label: 'Review Approvals', icon: <Clock className="h-4 w-4" />, roles: ['clerk', 'supervisor', 'admin'] },
              { to: '/payroll', label: 'Run Payroll', icon: <TrendingUp className="h-4 w-4" />, roles: ['admin'] },
              { to: '/payroll', label: 'Pay Workers', icon: <Wallet className="h-4 w-4" />, roles: ['admin'] },
              { to: '/settings', label: 'Add Worker', icon: <UserPlus className="h-4 w-4" />, roles: ['supervisor', 'admin'] },
              { to: '/settings', label: 'Add Garment', icon: <Plus className="h-4 w-4" />, roles: ['supervisor', 'admin'] },
              { to: '/analytics', label: 'View Reports', icon: <BarChart3 className="h-4 w-4" />, roles: ['supervisor', 'admin'] },
            ].filter(a => a.roles.includes(user?.role ?? '')).map((a) => (
              <Link key={a.to + a.label} to={a.to} className={buttonVariants({ variant: 'outline' }) + ' justify-start gap-2 h-auto py-3'}>
                {a.icon}
                {a.label}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Earnings per Worker */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly Earnings Per Worker</CardTitle>
        </CardHeader>
        <CardContent>
          {weeklyEarnings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No production this week.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Worker</th>
                    {daysOfWeek.map((d) => (
                      <th key={d} className="text-right py-2 font-medium text-muted-foreground">
                        {new Date(d).toLocaleDateString('en', { weekday: 'short' })}
                      </th>
                    ))}
                    <th className="text-right py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklyEarnings.map((w) => (
                    <tr key={w.workerId} className="border-b last:border-0">
                      <td className="py-2 font-medium">
                        <Link to={`/workers/${w.workerId}`} className="hover:text-primary hover:underline">{resolveName(w.workerId, workers)}</Link>
                      </td>
                      {daysOfWeek.map((d) => (
                        <td key={d} className="text-right py-2 text-muted-foreground">
                          {w.daily[d] ? `${w.daily[d].toFixed(0)}` : '—'}
                        </td>
                      ))}
                      <td className="text-right py-2 font-bold">{w.total.toFixed(0)} KES</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
