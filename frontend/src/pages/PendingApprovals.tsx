import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useProductionLogs, useApproveProductionLog, ProductionLog } from '../hooks/useProductionLogs';
import { useAdvances, useApproveAdvance, Advance } from '../hooks/useAdvances';
import { useWorkers } from '../hooks/useWorkers';
import { useProducts } from '../hooks/useProducts';
import { useUsers } from '../hooks/useUsers';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import SearchInput from '../components/ui/SearchInput';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import { CheckCircle, Clock, Check, User, Calendar, Scissors, Wallet } from 'lucide-react';

function resolveName(id: number, items: { id: number; name: string }[] | undefined): string {
  return items?.find((i) => i.id === id)?.name ?? `#${id}`;
}

type StatusFilter = 'pending' | 'approved' | 'all';

const filterTabs: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'all', label: 'All' },
];

export default function PendingApprovals() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('production');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmTarget, setConfirmTarget] = useState<ProductionLog | Advance | 'bulk' | null>(null);
  const pageSize = 10;

  const { data: logs, isLoading: lLoad } = useProductionLogs();
  const { data: advances, isLoading: aLoad } = useAdvances();
  const { data: workers } = useWorkers();
  const { data: products } = useProducts();
  const { data: users } = useUsers();
  const { isSupervisor } = useAuth();
  const approveLog = useApproveProductionLog();
  const approveAdvance = useApproveAdvance();

  const loading = lLoad || aLoad;

  const resolveUser = (id: number | null) => {
    if (id == null) return null;
    return users?.find((u) => u.id === id)?.username ?? `#${id}`;
  };

  const filteredLogs = useMemo(() => {
    const items = logs ?? [];
    const q = search.toLowerCase();
    return items.filter((l) => {
      const matchesSearch =
        !q ||
        resolveName(l.worker_id, workers).toLowerCase().includes(q) ||
        resolveName(l.product_id, products).toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'pending' ? !l.approved : l.approved);
      return matchesSearch && matchesStatus;
    });
  }, [logs, workers, products, search, statusFilter]);

  const filteredAdvances = useMemo(() => {
    const items = advances ?? [];
    const q = search.toLowerCase();
    return items.filter((a) => {
      const matchesSearch =
        !q || resolveName(a.worker_id, workers).toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'pending' ? !a.approved : a.approved);
      return matchesSearch && matchesStatus;
    });
  }, [advances, workers, search, statusFilter]);

  const logsPage = filteredLogs.slice((page - 1) * pageSize, page * pageSize);
  const advancesPage = filteredAdvances.slice((page - 1) * pageSize, page * pageSize);

  const pendingLogCount = (logs ?? []).filter((l) => !l.approved).length;
  const pendingAdvCount = (advances ?? []).filter((a) => !a.approved).length;

  const countsByStatus = (items: { approved: boolean }[]) => ({
    pending: items.filter((i) => !i.approved).length,
    approved: items.filter((i) => i.approved).length,
    all: items.length,
  });

  const logCounts = countsByStatus(logs ?? []);
  const advCounts = countsByStatus(advances ?? []);

  const handleSelectAll = (checked: boolean, items: { id: number }[]) => {
    if (checked) {
      setSelected(new Set(items.map((i) => i.id)));
    } else {
      setSelected(new Set());
    }
  };

  const handleSelectOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkApprove = async () => {
    setConfirmTarget(null);
    const ids = [...selected];
    try {
      if (activeTab === 'production') {
        for (const id of ids) await approveLog.mutateAsync(id);
      } else {
        for (const id of ids) await approveAdvance.mutateAsync(id);
      }
      toast.success(`Approved ${ids.length} item(s)`);
      setSelected(new Set());
    } catch {
      toast.error('Failed to approve some items');
    }
  };

  const handleSingleApprove = async () => {
    if (!confirmTarget || confirmTarget === 'bulk') return;
    setConfirmTarget(null);
    try {
      if (activeTab === 'production') {
        await approveLog.mutateAsync(confirmTarget.id);
      } else {
        await approveAdvance.mutateAsync(confirmTarget.id);
      }
      toast.success('Approved');
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(confirmTarget.id);
        return next;
      });
    } catch {
      toast.error('Failed to approve');
    }
  };

  const selectedOnPage = (pageItems: { id: number }[]) =>
    pageItems.filter((i) => selected.has(i.id));

  const resetFilters = () => {
    setPage(1);
    setSelected(new Set());
  };

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    resetFilters();
  };

  const handleStatusChange = (val: StatusFilter) => {
    setStatusFilter(val);
    resetFilters();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Approvals</h2>
          <p className="text-muted-foreground text-sm">
            {pendingLogCount} production · {pendingAdvCount} advances pending
          </p>
        </div>
        <div className="w-64">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
              setSelected(new Set());
            }}
          />
        </div>
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
        {[
          { id: 'production', label: 'Production', count: pendingLogCount, icon: <Scissors className="h-3.5 w-3.5" /> },
          { id: 'advances', label: 'Advances', count: pendingAdvCount, icon: <Wallet className="h-3.5 w-3.5" /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
              activeTab === t.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.icon}
            {t.label}
            <span className="text-xs opacity-60">({t.count})</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {filterTabs.map((f) => {
          const count =
            activeTab === 'production'
              ? logCounts[f.value]
              : advCounts[f.value];
          return (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleStatusChange(f.value)}
            >
              {f.label} ({count})
            </Button>
          );
        })}
      </div>

      <div className="space-y-4">
        {activeTab === 'production' && (
          loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <ApprovalTable
              type="production"
              items={logsPage}
              total={filteredLogs.length}
              page={page}
              pageSize={pageSize}
              selected={selected}
              selectedOnPage={selectedOnPage(logsPage as { id: number }[])}
              onPageChange={setPage}
              onSelectAll={(c) => handleSelectAll(c, logsPage as { id: number }[])}
              onSelectOne={handleSelectOne}
              onApprove={(item) => setConfirmTarget(item)}
              onBulkApprove={() => setConfirmTarget('bulk')}
              canApprove={isSupervisor}
              workers={workers ?? []}
              products={products ?? []}
              resolveUser={resolveUser}
            />
          )
        )}
        {activeTab === 'advances' && (
          loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <ApprovalTable
              type="advances"
              items={advancesPage}
              total={filteredAdvances.length}
              page={page}
              pageSize={pageSize}
              selected={selected}
              selectedOnPage={selectedOnPage(advancesPage as { id: number }[])}
              onPageChange={setPage}
              onSelectAll={(c) => handleSelectAll(c, advancesPage as { id: number }[])}
              onSelectOne={handleSelectOne}
              onApprove={(item) => setConfirmTarget(item)}
              onBulkApprove={() => setConfirmTarget('bulk')}
              canApprove={isSupervisor}
              workers={workers ?? []}
              resolveUser={resolveUser}
            />
          )
        )}
      </div>

      {isSupervisor && (
        <ApproveDialog
          open={confirmTarget !== null}
          target={confirmTarget}
          type={activeTab as 'production' | 'advances'}
          workers={workers ?? []}
          products={products ?? []}
          onConfirm={
            confirmTarget === 'bulk' ? handleBulkApprove : handleSingleApprove
          }
          onCancel={() => setConfirmTarget(null)}
          loading={approveLog.isPending || approveAdvance.isPending}
        />
      )}
    </div>
  );
}

// ---- Approval Table Sub-component ----

interface ApprovalTableProps {
  type: 'production' | 'advances';
  items: (ProductionLog | Advance)[];
  total: number;
  page: number;
  pageSize: number;
  selected: Set<number>;
  selectedOnPage: { id: number }[];
  onPageChange: (p: number) => void;
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: number) => void;
  onApprove: (item: ProductionLog | Advance) => void;
  onBulkApprove: () => void;
  canApprove: boolean;
  workers: { id: number; name: string }[];
  products?: { id: number; name: string }[];
  resolveUser: (id: number | null) => string | null;
}

function ApprovalTable({
  type,
  items,
  total,
  page,
  pageSize,
  selected,
  selectedOnPage,
  onPageChange,
  onSelectAll,
  onSelectOne,
  onApprove,
  onBulkApprove,
  canApprove,
  workers,
  products,
  resolveUser,
}: ApprovalTableProps) {
  if (total === 0) {
    return (
      <EmptyState
        icon={<CheckCircle className="h-12 w-12" />}
        title="All clear"
        description={
          selected.size > 0
            ? 'No matching items with current filters.'
            : type === 'production'
              ? 'All production logs have been approved.'
              : 'All advances have been approved.'
        }
      />
    );
  }

  const allChecked = items.length > 0 && selectedOnPage.length === items.length;
  const someChecked = selectedOnPage.length > 0 && !allChecked;

  return (
    <>
      {canApprove && (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
              checked={allChecked}
              ref={(el) => {
                if (el) el.indeterminate = someChecked;
              }}
              onChange={(e) => onSelectAll(e.target.checked)}
            />
            Select all
          </label>
          {selectedOnPage.length > 0 && (
            <Button size="sm" onClick={onBulkApprove}>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              Approve {selectedOnPage.length} selected
            </Button>
          )}
        </div>
      )}

      <Card className="divide-y">
        {items.map((item) => {
          const isProduction = type === 'production';
          const isProdItem = (i: ProductionLog | Advance): i is ProductionLog =>
            'production_date' in i;
          const dateStr = isProdItem(item) ? item.production_date : item.advance_date;
          const dateLabel = new Date(dateStr).toLocaleDateString('en', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          });

          return (
            <div
              key={item.id}
              className={`flex items-center gap-3 px-4 py-3 transition hover:bg-muted/30 ${
                selected.has(item.id) ? 'bg-primary/5 ring-1 ring-primary/20' : ''
              }`}
            >
              {/* Checkbox */}
              {canApprove && (
                <div className="flex-shrink-0">
                  {!item.approved ? (
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                      checked={selected.has(item.id)}
                      onChange={() => onSelectOne(item.id)}
                    />
                  ) : (
                    <div className="w-4" />
                  )}
                </div>
              )}

              {/* Avatar */}
              <div className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-muted">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
              </div>

              {/* Main content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {resolveName(item.worker_id, workers)}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {dateLabel}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                  {isProdItem(item) ? (
                    <>
                      <span>{resolveName(item.product_id, products!)}</span>
                      <span>&middot;</span>
                      <span>{item.quantity} pcs</span>
                      <span>&middot;</span>
                      <span className="font-medium text-foreground">
                        {item.amount.toFixed(0)} KES
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium text-foreground">
                        {item.amount.toFixed(0)} KES
                      </span>
                      {item.notes && (
                        <>
                          <span>&middot;</span>
                          <span className="truncate max-w-[200px]">{item.notes}</span>
                        </>
                      )}
                    </>
                  )}
                  {item.approved && (
                    <>
                      <span>&middot;</span>
                      <span>by {resolveUser(item.approved_by) ?? '—'}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <Badge
                variant={item.approved ? 'default' : 'secondary'}
                className="text-xs flex-shrink-0"
              >
                {item.approved ? (
                  <Check className="h-3 w-3 mr-1" />
                ) : (
                  <Clock className="h-3 w-3 mr-1" />
                )}
                {item.approved ? 'Approved' : 'Pending'}
              </Badge>

              {/* Approve button */}
              {canApprove && (
                <div className="flex-shrink-0 w-20 flex justify-end">
                  {!item.approved && (
                    <Button size="sm" variant="outline" onClick={() => onApprove(item)}>
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Approve
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Card>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onChange={onPageChange}
      />
    </>
  );
}

// ---- Confirmation Dialog ----

interface ApproveDialogProps {
  open: boolean;
  target: ProductionLog | Advance | 'bulk' | null;
  type: 'production' | 'advances';
  workers: { id: number; name: string }[];
  products?: { id: number; name: string }[];
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function ApproveDialog({
  open,
  target,
  type,
  workers,
  products,
  onConfirm,
  onCancel,
  loading,
}: ApproveDialogProps) {
  const isBulk = target === 'bulk';
  const item = !isBulk && target && typeof target === 'object' ? target : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isBulk ? 'Approve Selected Items' : `Approve ${type === 'production' ? 'Production Log' : 'Advance'}`}
          </DialogTitle>
          <DialogDescription>
            {isBulk ? (
              'Are you sure you want to approve all selected items?'
            ) : item ? (
              <span>
                Approve this entry for{' '}
                <strong>{resolveName(item.worker_id, workers)}</strong>
                {type === 'production' && 'product_id' in item && (
                  <>
                    {' '}&mdash;{' '}
                    <strong>
                      {resolveName(item.product_id, products!)}
                    </strong>{' '}
                    &times; {item.quantity} ({item.amount.toFixed(0)} KES)
                  </>
                )}
                {type === 'advances' && (
                  <>
                    {' '}&mdash;{' '}
                    <strong>{item.amount.toFixed(0)} KES</strong>
                  </>
                )}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? 'Approving...' : 'Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
