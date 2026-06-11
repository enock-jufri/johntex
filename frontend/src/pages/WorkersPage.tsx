import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useWorkers } from '../hooks/useWorkers';
import { useAllWallets } from '../hooks/useWallet';
import { useProductionLogs } from '../hooks/useProductionLogs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import SearchInput from '../components/ui/SearchInput';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import {
  Users, UserPlus, Phone, TrendingUp, Wallet, Scissors,
} from 'lucide-react';

function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (/^07\d{8}$/.test(cleaned)) return `+254 ${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  if (/^\+254\d{9}$/.test(cleaned)) return `+254 ${cleaned.slice(4, 7)} ${cleaned.slice(7, 10)} ${cleaned.slice(10)}`;
  if (/^254\d{9}$/.test(cleaned)) return `+254 ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
  return phone;
}

const pageSize = 12;

export default function WorkersPage() {
  const { data: workers, isLoading: workersLoading } = useWorkers();
  const { data: wallets } = useAllWallets();
  const { data: logs } = useProductionLogs();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const walletMap = useMemo(() => {
    if (!wallets) return {};
    const map: Record<number, typeof wallets[number]> = {};
    wallets.forEach((w) => { map[w.worker_id] = w; });
    return map;
  }, [wallets]);

  const pieceMap = useMemo(() => {
    if (!logs) return {};
    const map: Record<number, number> = {};
    logs.forEach((l) => { map[l.worker_id] = (map[l.worker_id] || 0) + l.quantity; });
    return map;
  }, [logs]);

  const filtered = useMemo(() => {
    if (!workers) return [];
    const q = search.toLowerCase();
    return workers.filter((w) =>
      !q || w.name.toLowerCase().includes(q) || w.phone.includes(q),
    );
  }, [workers, search]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const totals = useMemo(() => ({
    total: workers?.length ?? 0,
    active: workers?.filter((w) => w.active).length ?? 0,
    inactive: workers?.filter((w) => !w.active).length ?? 0,
    earned: Object.values(walletMap).reduce((s, w) => s + w.total_earned, 0),
    pieces: Object.values(pieceMap).reduce((s, n) => s + n, 0),
  }), [workers, walletMap, pieceMap]);

  if (workersLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!workers?.length) {
    return (
      <EmptyState
        icon={<Users className="h-12 w-12" />}
        title="No workers yet"
        description="Add your first worker in Settings."
        actionLabel="Go to Settings"
        actionTo="/settings"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Workers</h2>
        <p className="text-muted-foreground text-sm">
          {totals.total} workers — {totals.active} active, {totals.inactive} inactive
        </p>
      </div>

      {/* Summary banner */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Total Workers', value: totals.total, icon: <Users className="h-4 w-4 text-blue-500" /> },
          { label: 'Active', value: totals.active, icon: <span className="block h-2.5 w-2.5 rounded-full bg-emerald-500" /> },
          { label: 'Inactive', value: totals.inactive, icon: <span className="block h-2.5 w-2.5 rounded-full bg-gray-400" /> },
          { label: 'Total Earned', value: `${totals.earned.toLocaleString()} KES`, icon: <TrendingUp className="h-4 w-4 text-emerald-500" /> },
          { label: 'Total Pieces', value: totals.pieces.toLocaleString(), icon: <Scissors className="h-4 w-4 text-green-500" /> },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
            <div className="flex-shrink-0">{s.icon}</div>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <SearchInput
        value={search}
        onChange={(v) => { setSearch(v); setPage(1); }}
        placeholder="Search workers by name or phone..."
      />

      {/* Worker card grid */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-12 w-12" />} title="No workers match" description="Try a different search term." />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paged.map((w) => {
              const wallet = walletMap[w.id];
              const pieces = pieceMap[w.id] ?? 0;
              return (
                <Card key={w.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <Avatar className={`h-12 w-12 flex-shrink-0 ${w.active ? 'ring-2 ring-emerald-500/30' : 'ring-2 ring-gray-300 dark:ring-gray-700'}`}>
                        <AvatarFallback className={`text-lg font-bold ${w.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {w.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <Link to={`/workers/${w.id}`} className="font-semibold hover:text-primary hover:underline truncate block">
                          {w.name}
                        </Link>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 flex-shrink-0" />
                          {formatPhoneDisplay(w.phone)}
                        </p>
                        <Badge variant={w.active ? 'default' : 'destructive'} className="mt-1.5 text-xs">
                          {w.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                    <Separator className="my-4" />
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Earned</p>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {(wallet?.total_earned ?? 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Balance</p>
                        <p className={`text-sm font-bold ${(wallet?.balance ?? 0) >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                          {(wallet?.balance ?? 0).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Pieces</p>
                        <p className="text-sm font-bold">{pieces.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {filtered.length > pageSize && (
            <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}
