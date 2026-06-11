import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import type { AxiosError } from 'axios';
import { usePayrolls, useRunPayroll } from '../hooks/usePayroll';
import { useWorkers } from '../hooks/useWorkers';
import { useMpesaPay, useMpesaBulkPay, useMarkCashPaid, useBulkMarkCashPaid, useUpdatePaymentMethod, useResetStuckPayment } from '../hooks/usePayments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Calculator,
  Download,
  DollarSign,
  Users,
  TrendingUp,
  Smartphone,
  CheckSquare,
  Square,
  MinusSquare,
  Banknote,
  Send,
  AlertCircle,
  CheckCircle2,
  Clock,
  Phone,
  RotateCcw,
  Loader2,
} from 'lucide-react';

function resolveName(
  id: number,
  items: { id: number; name: string; phone?: string }[] | undefined,
): string {
  return items?.find((i) => i.id === id)?.name ?? `#${id}`;
}

function resolvePhone(
  id: number,
  items: { id: number; name: string; phone?: string }[] | undefined,
): string {
  return items?.find((i) => i.id === id)?.phone ?? '';
}

// ---- Payment status indicator ----

function PaymentStatus({ status }: { status: string }) {
  const config: Record<string, { dot: string; label: string }> = {
    pending: {
      dot: 'bg-gray-400',
      label: 'Pending',
    },
    processing: {
      dot: 'bg-amber-400 animate-pulse',
      label: 'Processing',
    },
    paid: {
      dot: 'bg-emerald-500',
      label: 'Paid',
    },
    failed: {
      dot: 'bg-red-500',
      label: 'Failed',
    },
  };
  const c = config[status] ?? config.pending;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`block h-2 w-2 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ---- Payment method badge ----

function PaymentMethodToggle({
  method,
  locked,
  onChange,
  pending,
}: {
  method: string;
  locked: boolean;
  onChange: () => void;
  pending: boolean;
}) {
  if (locked) {
    // Static badge — payment is processing or paid
    if (method === 'mpesa') {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
          <Smartphone className="h-3 w-3" />
          M-Pesa
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
        <Banknote className="h-3 w-3" />
        Cash
      </span>
    );
  }

  // Clickable toggle — payment still pending, can switch
  return (
    <button
      onClick={onChange}
      disabled={pending}
      className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
        method === 'mpesa'
          ? 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 dark:hover:bg-emerald-900'
          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800'
      } ${pending ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={`Click to switch to ${method === 'mpesa' ? 'Cash' : 'M-Pesa'}`}
    >
      {method === 'mpesa' ? (
        <Smartphone className="h-3 w-3" />
      ) : (
        <Banknote className="h-3 w-3" />
      )}
      {method === 'mpesa' ? 'M-Pesa' : 'Cash'}
      <span className="text-[10px] ml-0.5 opacity-60">↔</span>
    </button>
  );
}

// ---- Main component ----

export default function PayrollRun() {
  const [weekStart, setWeekStart] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('mpesa');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [payConfirmOpen, setPayConfirmOpen] = useState(false);
  const [singlePayTarget, setSinglePayTarget] = useState<number | null>(null);
  const [cashPayTarget, setCashPayTarget] = useState<number | null>(null);
  const [cashBulkOpen, setCashBulkOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [weekFilter, setWeekFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('unpaid');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const pageSize = 15;

  const { data: payrolls, isLoading } = usePayrolls();
  const { data: workers } = useWorkers();
  const runMutation = useRunPayroll();
  const mpesaPay = useMpesaPay();
  const mpesaBulkPay = useMpesaBulkPay();
  const markCashPaid = useMarkCashPaid();
  const bulkMarkCashPaid = useBulkMarkCashPaid();
  const updatePaymentMethod = useUpdatePaymentMethod();
  const resetStuck = useResetStuckPayment();

  const uniqueWeeks = useMemo(
    () =>
      [...new Set(payrolls?.map((p) => p.week_start) ?? [])]
        .sort()
        .reverse(),
    [payrolls],
  );

  const filtered = useMemo(() => {
    let items = payrolls ?? [];
    if (weekFilter !== 'all')
      items = items.filter((p) => p.week_start === weekFilter);
    if (statusFilter !== 'all') {
      if (statusFilter === 'unpaid') {
        items = items.filter((p) => p.payment_status !== 'paid');
      } else {
        items = items.filter((p) => p.payment_status === statusFilter);
      }
    }
    const q = search.toLowerCase();
    if (q)
      items = items.filter((p) =>
        resolveName(p.worker_id, workers).toLowerCase().includes(q),
      );
    return items;
  }, [payrolls, workers, weekFilter, search, statusFilter]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  // ---- Stats for the selected week ----
  const stats = useMemo(() => {
    const items =
      weekFilter !== 'all'
        ? (payrolls ?? []).filter((p) => p.week_start === weekFilter)
        : (payrolls ?? []);
    const mpesaItems = items.filter((p) => p.payment_method === 'mpesa');
    return {
      gross: items.reduce((s, p) => s + p.gross_pay, 0),
      net: items.reduce((s, p) => s + p.net_pay, 0),
      advances: items.reduce((s, p) => s + p.total_advances, 0),
      count: items.length,
      workers: new Set(items.map((p) => p.worker_id)).size,
      paid: items.filter((p) => p.payment_status === 'paid').length,
      pending: items.filter((p) => p.payment_status === 'pending').length,
      processing: items.filter((p) => p.payment_status === 'processing').length,
      failed: items.filter((p) => p.payment_status === 'failed').length,
      mpesaPendingValue: mpesaItems
        .filter((p) => p.payment_status === 'pending')
        .reduce((s, p) => s + p.net_pay, 0),
      mpesaPaidValue: mpesaItems
        .filter((p) => p.payment_status === 'paid')
        .reduce((s, p) => s + p.net_pay, 0),
      mpesaCount: mpesaItems.length,
      cashCount: items.filter((p) => p.payment_method === 'cash').length,
    };
  }, [payrolls, weekFilter]);

  // ---- Bulk selection logic ----
  const mpesaEligible = useMemo(
    () =>
      filtered.filter(
        (p) =>
          p.payment_method === 'mpesa' && p.payment_status === 'pending',
      ),
    [filtered],
  );

  const mpesaPendingOnPage = paged.filter(
    (p) =>
      p.payment_method === 'mpesa' && p.payment_status === 'pending',
  );

  const mpesaEligibleSelected = mpesaEligible.filter((p) =>
    selected.has(p.id),
  );

  const cashEligible = useMemo(
    () =>
      filtered.filter(
        (p) =>
          p.payment_method === 'cash' &&
          (p.payment_status === 'pending' || p.payment_status === 'failed'),
      ),
    [filtered],
  );

  const cashEligibleSelected = cashEligible.filter((p) =>
    selected.has(p.id),
  );

  const selectAllChecked =
    paged.length > 0 && paged.every((p) => selected.has(p.id));
  const selectAllIndeterminate =
    paged.some((p) => selected.has(p.id)) && !selectAllChecked;

  const handleSelectAll = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      paged.forEach((p) => {
        if (checked) next.add(p.id);
        else next.delete(p.id);
      });
      return next;
    });
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSelectMpesaPending = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      mpesaEligible.forEach((p) => next.add(p.id));
      return next;
    });
  };

  useEffect(() => {
    setSelected(new Set());
  }, [weekFilter, search, statusFilter, page]);

  // ---- Actions ----
  const handleRun = async () => {
    if (!weekStart) return;
    try {
      await runMutation.mutateAsync({ weekStart, paymentMethod });
      toast.success('Payroll calculated');
      setConfirmOpen(false);
      setWeekFilter(weekStart);
    } catch {
      toast.error('Failed to run payroll');
    }
  };

  const handleSinglePay = async (payrollId: number) => {
    try {
      await mpesaPay.mutateAsync(payrollId);
      toast.success('M-Pesa payment sent');
    } catch {
      toast.error('M-Pesa payment failed');
    }
  };

  const handleToggleMethod = async (payrollId: number, current: string) => {
    const next = current === 'mpesa' ? 'cash' : 'mpesa';
    try {
      await updatePaymentMethod.mutateAsync({ payrollId, paymentMethod: next });
      toast.success(`Switched to ${next === 'mpesa' ? 'M-Pesa' : 'Cash'}`);
    } catch {
      toast.error('Failed to update payment method');
    }
  };

  const handleBulkPay = async () => {
    if (!mpesaEligibleSelected.length) return;
    try {
      const result = await mpesaBulkPay.mutateAsync(
        mpesaEligibleSelected.map((p) => p.id),
      );
      toast.success(
        `${result.succeeded} payment${result.succeeded !== 1 ? 's' : ''} sent${result.failed ? `, ${result.failed} failed` : ''}`,
      );
      setPayConfirmOpen(false);
      setSelected(new Set());
    } catch {
      toast.error('Bulk payment failed');
    }
  };

  const handleSingleCashPay = async (payrollId: number) => {
    try {
      await markCashPaid.mutateAsync(payrollId);
      toast.success('Marked as paid (cash)');
    } catch (err) {
      const msg = (err as AxiosError<{ detail: string }>)?.response?.data?.detail;
      toast.error(msg || 'Failed');
    }
  };

  const handleBulkCashPay = async () => {
    if (!cashEligibleSelected.length) return;
    try {
      const result = await bulkMarkCashPaid.mutateAsync(
        cashEligibleSelected.map((p) => p.id),
      );
      toast.success(
        `${result.succeeded} marked paid${result.failed ? `, ${result.failed} failed` : ''}`,
      );
      setCashBulkOpen(false);
      setSelected(new Set());
    } catch {
      toast.error('Bulk cash payment failed');
    }
  };

  const exportCSV = () => {
    if (!filtered.length) return;
    const h =
      'Worker,Phone,Week,Gross Pay,Advances,Net Pay,Method,Payment Status\n';
    const rows = filtered
      .map(
        (p) =>
          `${resolveName(p.worker_id, workers)},${resolvePhone(p.worker_id, workers)},${p.week_start},${p.gross_pay},${p.total_advances},${p.net_pay},${p.payment_method},${p.payment_status}`,
      )
      .join('\n');
    const blob = new Blob([h + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `payroll-${weekFilter === 'all' ? 'all' : weekFilter}.csv`;
    a.click();
  };

  const bulkTotal = mpesaEligibleSelected.reduce((s, p) => s + p.net_pay, 0);
  const showWeekData = (payrolls ?? []).length > 0;

  return (
    <div className="space-y-6">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Payroll</h2>
          <p className="text-muted-foreground text-sm">
            Calculate pay and disburse to workers
          </p>
        </div>
        {weekFilter !== 'all' && showWeekData && (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            Week of {weekFilter}
          </Badge>
        )}
      </div>

      {/* ---- Step 1: Run Payroll ---- */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-rose-100 dark:bg-rose-900 text-rose-600 dark:text-rose-400 text-xs font-bold">
              1
            </div>
            Calculate Payroll
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Week Start (Monday)
            </label>
            <Input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Default Pay Method</label>
            <Select
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v || 'mpesa')}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={!weekStart || runMutation.isPending}
          >
            {runMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Calculator className="mr-2 h-4 w-4" />
            )}
            {runMutation.isPending ? 'Calculating...' : 'Run Payroll'}
          </Button>
        </CardContent>
      </Card>

      {/* ---- Loading ---- */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      )}

      {/* ---- Loaded content ---- */}
      {!isLoading && showWeekData && (
        <>
          {/* ---- Payment Pipeline ---- */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                  2
                </div>
                Payment Pipeline
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  {weekFilter === 'all' ? 'All weeks' : `Week of ${weekFilter}`}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Summary numbers */}
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 mb-4">
                {[
                  {
                    label: 'Total Payroll',
                    value: `${stats.net.toLocaleString()} KES`,
                    sub: `${stats.workers} workers`,
                    icon: <DollarSign className="h-4 w-4 text-blue-500" />,
                  },
                  {
                    label: 'Paid',
                    value: stats.paid,
                    sub: `${stats.mpesaPaidValue.toLocaleString()} KES`,
                    icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
                  },
                  {
                    label: 'Pending',
                    value: stats.pending,
                    sub: `${stats.mpesaPendingValue.toLocaleString()} KES`,
                    icon: <Clock className="h-4 w-4 text-amber-500" />,
                  },
                  {
                    label: 'Processing',
                    value: stats.processing,
                    sub: 'Awaiting confirmation',
                    icon: <Loader2 className="h-4 w-4 text-purple-500" />,
                  },
                  {
                    label: 'M-Pesa',
                    value: stats.mpesaCount,
                    sub: `${stats.cashCount} cash`,
                    icon: <Smartphone className="h-4 w-4 text-emerald-500" />,
                  },
                  {
                    label: 'Failed',
                    value: stats.failed,
                    sub: 'Needs attention',
                    icon: <AlertCircle className="h-4 w-4 text-red-500" />,
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div className="mt-0.5 flex-shrink-0">{s.icon}</div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {s.label}
                      </p>
                      <p className="text-lg font-bold">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pipeline bar */}
              {stats.count > 0 && (
                <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                  {stats.paid > 0 && (
                    <div
                      className="bg-emerald-500 transition-all"
                      style={{
                        width: `${(stats.paid / stats.count) * 100}%`,
                      }}
                    />
                  )}
                  {stats.processing > 0 && (
                    <div
                      className="bg-purple-400 transition-all"
                      style={{
                        width: `${(stats.processing / stats.count) * 100}%`,
                      }}
                    />
                  )}
                  {stats.pending > 0 && (
                    <div
                      className="bg-amber-300 transition-all"
                      style={{
                        width: `${(stats.pending / stats.count) * 100}%`,
                      }}
                    />
                  )}
                  {stats.failed > 0 && (
                    <div
                      className="bg-red-400 transition-all"
                      style={{
                        width: `${(stats.failed / stats.count) * 100}%`,
                      }}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ---- Status filter tabs ---- */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {[
              { value: 'unpaid', label: 'Unpaid' },
              { value: 'pending', label: 'Pending' },
              { value: 'processing', label: 'Processing' },
              { value: 'paid', label: 'Paid' },
              { value: 'failed', label: 'Failed' },
              { value: 'all', label: 'All' },
            ].map((f) => {
              const base = payrolls ?? [];
              const weekItems = weekFilter !== 'all' ? base.filter((p) => p.week_start === weekFilter) : base;
              const count = weekItems.filter((p) => {
                if (f.value === 'unpaid') return p.payment_status !== 'paid';
                if (f.value === 'all') return true;
                return p.payment_status === f.value;
              }).length;
              return (
                <Button
                  key={f.value}
                  variant={statusFilter === f.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter(f.value); setPage(1); setSelected(new Set()); }}
                >
                  {f.label} ({count})
                </Button>
              );
            })}
          </div>

          {/* ---- Toolbar ---- */}
          <div className="flex items-center gap-3 flex-wrap">
            <Select
              value={weekFilter}
              onValueChange={(v) => {
                setWeekFilter(v || 'all');
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Weeks" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Weeks</SelectItem>
                {uniqueWeeks.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Search worker..."
            />
            <div className="flex-1" />
            {mpesaEligible.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectMpesaPending}
              >
                <Smartphone className="mr-1 h-3.5 w-3.5" />
                Select all pending M-Pesa ({mpesaEligible.length})
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
            </Button>
          </div>

          {/* ---- Bulk action bar ---- */}
          {selected.size > 0 && (
            <Card className="border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/50">
              <CardContent className="flex items-center gap-4 p-3 flex-wrap">
                <span className="text-sm font-medium">
                  {selected.size} selected
                  {mpesaEligibleSelected.length > 0
                    ? ` — ${mpesaEligibleSelected.length} ready for M-Pesa (${bulkTotal.toLocaleString()} KES)`
                    : ''}
                  {cashEligibleSelected.length > 0
                    ? ` — ${cashEligibleSelected.length} cash`
                    : ''}
                </span>
                <Button
                  size="sm"
                  disabled={mpesaEligibleSelected.length === 0}
                  onClick={() => setPayConfirmOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Send className="mr-2 h-4 w-4" />
                  Pay {mpesaEligibleSelected.length} via M-Pesa
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={cashEligibleSelected.length === 0}
                  onClick={() => setCashBulkOpen(true)}
                >
                  <Banknote className="mr-2 h-4 w-4" />
                  Mark {cashEligibleSelected.length} Paid (Cash)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelected(new Set())}
                >
                  Clear
                </Button>
              </CardContent>
            </Card>
          )}

          {/* ---- Payroll Table ---- */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Calculator className="h-12 w-12" />}
              title="No matching records"
              description="Try a different week or search term."
            />
          ) : (
            <>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <button
                          className="inline-flex items-center justify-center"
                          onClick={() =>
                            handleSelectAll(!selectAllChecked)
                          }
                        >
                          {selectAllIndeterminate ? (
                            <MinusSquare className="h-4 w-4" />
                          ) : selectAllChecked ? (
                            <CheckSquare className="h-4 w-4" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </TableHead>
                      <TableHead>Worker</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Phone
                      </TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">
                        Advances
                      </TableHead>
                      <TableHead className="text-right">Net Pay</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map((p) => {
                      const phone = resolvePhone(p.worker_id, workers);
                      const workerName = resolveName(p.worker_id, workers);
                      const isPending =
                        p.payment_method === 'mpesa' &&
                        p.payment_status === 'pending';
                      const isFailed = p.payment_status === 'failed';
                      const showPay =
                        isPending || (isFailed && p.payment_method === 'mpesa');
                      const isCashPending =
                        p.payment_method === 'cash' &&
                        (p.payment_status === 'pending' || p.payment_status === 'failed');
                      const showCashPay = isCashPending;

                      return (
                        <TableRow key={p.id}>
                          <TableCell>
                            <button
                              className="inline-flex items-center justify-center"
                              onClick={() =>
                                handleSelectOne(
                                  p.id,
                                  !selected.has(p.id),
                                )
                              }
                            >
                              {selected.has(p.id) ? (
                                <CheckSquare className="h-4 w-4" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">
                              {workerName}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {p.week_start}
                            </p>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            {phone ? (
                              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {phone}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {p.gross_pay.toFixed(0)}
                          </TableCell>
                          <TableCell className="text-right text-sm text-red-600 dark:text-red-400">
                            -{p.total_advances.toFixed(0)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              {p.net_pay.toFixed(0)}
                            </span>
                            <span className="text-xs text-muted-foreground ml-0.5">
                              KES
                            </span>
                          </TableCell>
                          <TableCell>
                            <PaymentMethodToggle
                              method={p.payment_method}
                              locked={
                                p.payment_status === 'processing' ||
                                p.payment_status === 'paid'
                              }
                              pending={updatePaymentMethod.isPending}
                              onChange={() =>
                                handleToggleMethod(
                                  p.id,
                                  p.payment_method,
                                )
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <PaymentStatus status={p.payment_status} />
                          </TableCell>
                          <TableCell className="text-right">
                            {showPay && (
                              <Button
                                size="sm"
                                variant={
                                  isFailed ? 'outline' : 'default'
                                }
                                className={
                                  isFailed
                                    ? ''
                                    : 'bg-emerald-600 hover:bg-emerald-700'
                                }
                                disabled={mpesaPay.isPending}
                                onClick={() =>
                                  setSinglePayTarget(p.id)
                                }
                              >
                                {isFailed ? (
                                  <RotateCcw className="mr-1 h-3 w-3" />
                                ) : (
                                  <Send className="mr-1 h-3 w-3" />
                                )}
                                {isFailed ? 'Retry' : 'Pay'}
                              </Button>
                            )}
                            {showCashPay && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="ml-1"
                                disabled={markCashPaid.isPending}
                                onClick={() => setCashPayTarget(p.id)}
                              >
                                <Banknote className="mr-1 h-3 w-3" />
                                Mark Paid
                              </Button>
                            )}
                            {p.payment_status === 'processing' && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={resetStuck.isPending}
                                onClick={async () => {
                                  try {
                                    const result = await resetStuck.mutateAsync({
                                      entity: 'payroll',
                                      entityId: p.id,
                                    });
                                    toast.success(
                                      result.new_status === 'paid'
                                        ? 'Payment actually succeeded — marked paid'
                                        : 'Reset — you can now retry payment'
                                    );
                                  } catch { toast.error('Failed to reset'); }
                                }}
                              >
                                <RotateCcw className="mr-1 h-3 w-3" />
                                Retry
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
              <Pagination
                page={page}
                pageSize={pageSize}
                total={filtered.length}
                onChange={setPage}
              />
            </>
          )}
        </>
      )}

      {/* ---- Empty state (no data at all) ---- */}
      {!isLoading && (payrolls ?? []).length === 0 && (
        <EmptyState
          icon={<Calculator className="h-12 w-12" />}
          title="No payroll records"
          description="Select a week and run payroll to get started."
        />
      )}

      {/* ---- Confirm Run Payroll ---- */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Run Payroll</DialogTitle>
            <DialogDescription>
              Calculate pay for week starting{' '}
              <strong>{weekStart}</strong>. Workers will be set to{' '}
              <strong>
                {paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash'}
              </strong>{' '}
              by default. Re-running recalculates existing entries.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRun}
              disabled={runMutation.isPending}
            >
              {runMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Calculate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Confirm Single M-Pesa Pay ---- */}
      <Dialog
        open={singlePayTarget !== null}
        onOpenChange={() => setSinglePayTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send M-Pesa Payment</DialogTitle>
            <DialogDescription>
              Pay{' '}
              <strong>
                {singlePayTarget !== null
                  ? resolveName(
                      payrolls?.find((p) => p.id === singlePayTarget)
                        ?.worker_id ?? 0,
                      workers,
                    )
                  : ''}
              </strong>{' '}
              via M-Pesa to{' '}
              <strong>
                {singlePayTarget !== null
                  ? resolvePhone(
                      payrolls?.find((p) => p.id === singlePayTarget)
                        ?.worker_id ?? 0,
                      workers,
                    )
                  : ''}
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>
          {singlePayTarget !== null && (
            <p className="text-2xl font-bold text-center py-2">
              {payrolls
                ?.find((p) => p.id === singlePayTarget)
                ?.net_pay.toFixed(0)}{' '}
              KES
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSinglePayTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={mpesaPay.isPending}
              onClick={() => {
                if (singlePayTarget !== null)
                  handleSinglePay(singlePayTarget);
                setSinglePayTarget(null);
              }}
            >
              {mpesaPay.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Confirm Bulk M-Pesa Pay ---- */}
      <Dialog open={payConfirmOpen} onOpenChange={setPayConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Bulk M-Pesa Payments</DialogTitle>
            <DialogDescription>
              Pay {mpesaEligibleSelected.length} worker
              {mpesaEligibleSelected.length !== 1 ? 's' : ''} — total{' '}
              <strong>{bulkTotal.toLocaleString()} KES</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-52 overflow-y-auto space-y-2 text-sm">
            {mpesaEligibleSelected.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border-b pb-1.5"
              >
                <div>
                  <span className="font-medium">
                    {resolveName(p.worker_id, workers)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {resolvePhone(p.worker_id, workers)}
                  </span>
                </div>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {p.net_pay.toFixed(0)} KES
                </span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPayConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleBulkPay}
              disabled={mpesaBulkPay.isPending}
            >
              {mpesaBulkPay.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Pay {mpesaEligibleSelected.length} Workers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Confirm Single Cash Pay ---- */}
      <Dialog
        open={cashPayTarget !== null}
        onOpenChange={() => setCashPayTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Paid (Cash)</DialogTitle>
            <DialogDescription>
              Confirm cash payment for{' '}
              <strong>
                {cashPayTarget !== null
                  ? resolveName(
                      payrolls?.find((p) => p.id === cashPayTarget)
                        ?.worker_id ?? 0,
                      workers,
                    )
                  : ''}
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>
          {cashPayTarget !== null && (
            <p className="text-2xl font-bold text-center py-2">
              {payrolls
                ?.find((p) => p.id === cashPayTarget)
                ?.net_pay.toFixed(0)}{' '}
              KES
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCashPayTarget(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (cashPayTarget !== null)
                  handleSingleCashPay(cashPayTarget);
                setCashPayTarget(null);
              }}
              disabled={markCashPaid.isPending}
            >
              {markCashPaid.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Banknote className="mr-2 h-4 w-4" />
              )}
              Mark Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Confirm Bulk Cash Pay ---- */}
      <Dialog open={cashBulkOpen} onOpenChange={setCashBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as Paid (Cash)</DialogTitle>
            <DialogDescription>
              Mark {cashEligibleSelected.length} worker
              {cashEligibleSelected.length !== 1 ? 's' : ''} as paid via
              cash.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-52 overflow-y-auto space-y-2 text-sm">
            {cashEligibleSelected.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between border-b pb-1.5"
              >
                <div>
                  <span className="font-medium">
                    {resolveName(p.worker_id, workers)}
                  </span>
                </div>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {p.net_pay.toFixed(0)} KES
                </span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCashBulkOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBulkCashPay}
              disabled={bulkMarkCashPaid.isPending}
            >
              {bulkMarkCashPaid.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Banknote className="mr-2 h-4 w-4" />
              )}
              Mark {cashEligibleSelected.length} Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
