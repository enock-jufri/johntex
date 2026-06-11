import { useState, useMemo, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useWorkers } from '../hooks/useWorkers';
import { useAdvances, useCreateAdvance } from '../hooks/useAdvances';
import { useUsers } from '../hooks/useUsers';
import {
  useMpesaPayAdvance,
  useMpesaBulkPayAdvances,
  useMarkAdvanceCashPaid,
  useBulkMarkAdvanceCashPaid,
  useUpdateAdvancePaymentMethod,
  useResetStuckPayment,
} from '../hooks/usePayments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Wallet,
  DollarSign,
  Clock,
  CheckCircle,
  Calendar,
  User,
  Plus,
  Loader2,
  Smartphone,
  CheckSquare,
  Square,
  MinusSquare,
  Banknote,
  Send,
  AlertCircle,
  Phone,
  RotateCcw,
} from 'lucide-react';

function resolveName(id: number, items: { id: number; name: string; phone?: string }[] | undefined): string {
  return items?.find((i) => i.id === id)?.name ?? `#${id}`;
}

function resolvePhone(id: number, items: { id: number; name: string; phone?: string }[] | undefined): string {
  return items?.find((i) => i.id === id)?.phone ?? '';
}

function today() { return new Date().toISOString().slice(0, 10); }

function PaymentStatus({ status }: { status: string }) {
  const config: Record<string, { dot: string; label: string }> = {
    pending: { dot: 'bg-gray-400', label: 'Pending' },
    processing: { dot: 'bg-amber-400 animate-pulse', label: 'Processing' },
    paid: { dot: 'bg-emerald-500', label: 'Paid' },
    failed: { dot: 'bg-red-500', label: 'Failed' },
  };
  const c = config[status] ?? config.pending;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`block h-2 w-2 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

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
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
        method === 'mpesa'
          ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950'
          : 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800'
      }`}>
        {method === 'mpesa' ? <Smartphone className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
        {method === 'mpesa' ? 'M-Pesa' : 'Cash'}
      </span>
    );
  }
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
      {method === 'mpesa' ? <Smartphone className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
      {method === 'mpesa' ? 'M-Pesa' : 'Cash'}
      <span className="text-[10px] ml-0.5 opacity-60">↔</span>
    </button>
  );
}

export default function AdvanceRequest() {
  const [selectedDate, setSelectedDate] = useState(today());

  const { isAdmin } = useAuth();
  const { data: workers, isLoading: wLoad } = useWorkers();
  const { data: dailyAdvances, isLoading: aLoad } = useAdvances(undefined, selectedDate, selectedDate);
  const { data: users } = useUsers();
  const createMutation = useCreateAdvance();

  const [workerId, setWorkerId] = useState('');
  const [advanceDate, setAdvanceDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── Advances payout state ──
  const mpesaPayAdvance = useMpesaPayAdvance();
  const mpesaBulkPayAdvances = useMpesaBulkPayAdvances();
  const markAdvanceCashPaid = useMarkAdvanceCashPaid();
  const bulkMarkAdvanceCashPaid = useBulkMarkAdvanceCashPaid();
  const updateAdvancePaymentMethod = useUpdateAdvancePaymentMethod();
  const resetStuck = useResetStuckPayment();

  const [payoutSearch, setPayoutSearch] = useState('');
  const [payoutSelected, setPayoutSelected] = useState<Set<number>>(new Set());
  const [payoutPage, setPayoutPage] = useState(1);
  const [singlePayTarget, setSinglePayTarget] = useState<number | null>(null);
  const [cashPayTarget, setCashPayTarget] = useState<number | null>(null);
  const [bulkPayOpen, setBulkPayOpen] = useState(false);
  const [cashBulkOpen, setCashBulkOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('unpaid');
  const payoutPageSize = 10;

  const approvedAdvances = useMemo(
    () =>
      (dailyAdvances ?? [])
        .filter((a) => a.approved)
        .sort((a, b) => {
          // Sort unpaid first, then paid
          const aIsUnpaid = a.payment_status === 'pending' || a.payment_status === 'processing' || a.payment_status === 'failed';
          const bIsUnpaid = b.payment_status === 'pending' || b.payment_status === 'processing' || b.payment_status === 'failed';
          if (aIsUnpaid && !bIsUnpaid) return -1;
          if (!aIsUnpaid && bIsUnpaid) return 1;
          // Within same group, sort by date descending
          return new Date(b.advance_date).getTime() - new Date(a.advance_date).getTime();
        }),
    [dailyAdvances],
  );

  const filteredAdvances = useMemo(() => {
    let items = approvedAdvances;
    if (statusFilter !== 'all') {
      if (statusFilter === 'unpaid') {
        items = items.filter((a) => a.payment_status !== 'paid');
      } else {
        items = items.filter((a) => a.payment_status === statusFilter);
      }
    }
    const q = payoutSearch.toLowerCase();
    if (q)
      items = items.filter((a) =>
        resolveName(a.worker_id, workers).toLowerCase().includes(q),
      );
    return items;
  }, [approvedAdvances, workers, payoutSearch, statusFilter]);

  const pagedAdvances = filteredAdvances.slice(
    (payoutPage - 1) * payoutPageSize,
    payoutPage * payoutPageSize,
  );

  const mpesaEligible = useMemo(
    () =>
      filteredAdvances.filter(
        (a) =>
          a.payment_method === 'mpesa' && a.payment_status === 'pending',
      ),
    [filteredAdvances],
  );

  const mpesaSelected = mpesaEligible.filter((a) => payoutSelected.has(a.id));
  const mpesaBulkAmount = mpesaSelected.reduce((s, a) => s + a.amount, 0);

  const cashEligible = useMemo(
    () =>
      filteredAdvances.filter(
        (a) =>
          a.payment_method === 'cash' &&
          (a.payment_status === 'pending' || a.payment_status === 'failed'),
      ),
    [filteredAdvances],
  );

  const cashSelected = cashEligible.filter((a) => payoutSelected.has(a.id));

  const payoutStats = useMemo(() => ({
    total: approvedAdvances.length,
    totalAmount: approvedAdvances.reduce((s, a) => s + a.amount, 0),
    unpaidCount: approvedAdvances.filter((a) => a.payment_status !== 'paid').length,
    unpaidAmount: approvedAdvances.filter((a) => a.payment_status !== 'paid').reduce((s, a) => s + a.amount, 0),
    paidCount: approvedAdvances.filter((a) => a.payment_status === 'paid').length,
    paidAmount: approvedAdvances.filter((a) => a.payment_status === 'paid').reduce((s, a) => s + a.amount, 0),
    mpesaCount: approvedAdvances.filter((a) => a.payment_method === 'mpesa').length,
    mpesaPending: approvedAdvances.filter((a) => a.payment_method === 'mpesa' && a.payment_status === 'pending').length,
    cashCount: approvedAdvances.filter((a) => a.payment_method === 'cash').length,
  }), [approvedAdvances]);

  useEffect(() => {
    setPayoutSelected(new Set());
    setPayoutPage(1);
  }, [payoutSearch, statusFilter]);

  const handleSinglePay = async (advanceId: number) => {
    try {
      await mpesaPayAdvance.mutateAsync(advanceId);
      toast.success('Advance M-Pesa payment sent');
    } catch {
      toast.error('Advance M-Pesa payment failed');
    }
  };

  const handleToggleMethod = async (advanceId: number, current: string) => {
    const next = current === 'mpesa' ? 'cash' : 'mpesa';
    try {
      await updateAdvancePaymentMethod.mutateAsync({ advanceId, paymentMethod: next });
      toast.success(`Switched to ${next === 'mpesa' ? 'M-Pesa' : 'Cash'}`);
    } catch {
      toast.error('Failed to update payment method');
    }
  };

  const handleBulkPay = async () => {
    if (!mpesaSelected.length) return;
    try {
      const result = await mpesaBulkPayAdvances.mutateAsync(mpesaSelected.map((a) => a.id));
      toast.success(`${result.succeeded} payment${result.succeeded !== 1 ? 's' : ''} sent${result.failed ? `, ${result.failed} failed` : ''}`);
      setBulkPayOpen(false);
      setPayoutSelected(new Set());
    } catch {
      toast.error('Bulk advance payment failed');
    }
  };

  const handleSingleCashPay = async (advanceId: number) => {
    try {
      await markAdvanceCashPaid.mutateAsync(advanceId);
      toast.success('Advance marked as paid (cash)');
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed');
    }
  };

  const handleBulkCashPay = async () => {
    if (!cashSelected.length) return;
    try {
      const result = await bulkMarkAdvanceCashPaid.mutateAsync(cashSelected.map((a) => a.id));
      toast.success(`${result.succeeded} advance${result.succeeded !== 1 ? 's' : ''} marked paid${result.failed ? `, ${result.failed} failed` : ''}`);
      setCashBulkOpen(false);
      setPayoutSelected(new Set());
    } catch {
      toast.error('Bulk cash payment failed');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setPayoutSelected((prev) => {
      const next = new Set(prev);
      selectableOnPage.forEach((a) => {
        if (checked) next.add(a.id);
        else next.delete(a.id);
      });
      return next;
    });
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    setPayoutSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const selectableOnPage = pagedAdvances.filter((a) => a.payment_status !== 'paid');
  const allChecked = selectableOnPage.length > 0 && selectableOnPage.every((a) => payoutSelected.has(a.id));
  const indeterminate = selectableOnPage.some((a) => payoutSelected.has(a.id)) && !allChecked;

  const stats = useMemo(() => {
    const items = dailyAdvances ?? [];
    return {
      total: items.reduce((s, a) => s + a.amount, 0),
      approved: items.filter((a) => a.approved).reduce((s, a) => s + a.amount, 0),
      pending: items.filter((a) => !a.approved).reduce((s, a) => s + a.amount, 0),
      count: items.length,
      approvedCount: items.filter((a) => a.approved).length,
      pendingCount: items.filter((a) => !a.approved).length,
    };
  }, [dailyAdvances]);

  const resolveUser = (id: number | null) =>
    id ? users?.find((u) => u.id === id)?.username ?? `#${id}` : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errs: Record<string, string> = {};
    if (!workerId) errs.workerId = 'Select a worker';
    if (!amount || Number(amount) <= 0) errs.amount = 'Enter an amount greater than 0';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      await createMutation.mutateAsync({
        worker_id: Number(workerId),
        advance_date: advanceDate,
        amount: Number(amount),
        notes: notes || undefined,
      });
      toast.success('Advance submitted');
      setWorkerId('');
      setAmount('');
      setNotes('');
      setAdvanceDate(today());
      setFormErrors({});
      setSelectedDate(advanceDate);
    } catch { toast.error('Failed to submit advance'); }
  };

  const dateLabel = selectedDate === today()
    ? 'Today'
    : new Date(selectedDate).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Advances</h2>
          <p className="text-muted-foreground text-sm">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-44"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Advances', value: `${stats.total.toLocaleString()} KES`, icon: <DollarSign className="h-4 w-4 text-blue-500" />, bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300' },
          { label: 'Approved', value: `${stats.approved.toLocaleString()} KES`, icon: <CheckCircle className="h-4 w-4 text-green-500" />, bg: 'bg-green-50 dark:bg-green-950/30', text: 'text-green-700 dark:text-green-300', sub: `${stats.approvedCount} advances` },
          { label: 'Pending', value: `${stats.pending.toLocaleString()} KES`, icon: <Clock className="h-4 w-4 text-amber-500" />, bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', sub: `${stats.pendingCount} advances` },
          { label: 'Total Count', value: `${stats.count}`, icon: <Wallet className="h-4 w-4 text-purple-500" />, bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-700 dark:text-purple-300' },
        ].map((s) => (
          <Card key={s.label} className={`${s.bg} transition hover:shadow-md`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                {s.icon}
              </div>
              {aLoad ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                <>
                  <p className={`text-xl font-bold ${s.text}`}>{s.value}</p>
                  {s.sub && <p className="text-xs text-muted-foreground mt-0.5">{s.sub}</p>}
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Approved Advances Table ── */}
      {approvedAdvances.length > 0 && (
        <div className="border-t-2 pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Approved Advances</h2>
              <p className="text-muted-foreground text-sm">
                Unpaid first, paid at the bottom
              </p>
            </div>
            <Badge variant="outline" className="text-sm px-3 py-1">
              {dateLabel}
            </Badge>
          </div>

          {/* Payout stats */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5 mb-4">
            {[
              { label: 'Outstanding', value: `${payoutStats.unpaidAmount.toLocaleString()} KES`, sub: `${payoutStats.unpaidCount} advances`, icon: <AlertCircle className="h-4 w-4 text-amber-500" /> },
              { label: 'Paid', value: `${payoutStats.paidAmount.toLocaleString()} KES`, sub: `${payoutStats.paidCount} advances`, icon: <CheckCircle className="h-4 w-4 text-emerald-500" /> },
              { label: 'Pending M-Pesa', value: payoutStats.mpesaPending, sub: `${payoutStats.mpesaCount} M-Pesa`, icon: <Smartphone className="h-4 w-4 text-emerald-500" /> },
              { label: 'Cash', value: payoutStats.cashCount, sub: 'Ready for cash', icon: <Banknote className="h-4 w-4 text-gray-500" /> },
              { label: 'Total', value: `${payoutStats.totalAmount.toLocaleString()} KES`, sub: `${payoutStats.total} total`, icon: <Wallet className="h-4 w-4 text-blue-500" /> },
            ].map((s) => (
              <div key={s.label} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className="mt-0.5 flex-shrink-0">{s.icon}</div>
                <div>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Status filter tabs */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {[
              { value: 'unpaid', label: 'Unpaid' },
              { value: 'pending', label: 'Pending' },
              { value: 'processing', label: 'Processing' },
              { value: 'paid', label: 'Paid' },
              { value: 'failed', label: 'Failed' },
              { value: 'all', label: 'All' },
            ].map((f) => {
              const count = approvedAdvances.filter((a) => {
                if (f.value === 'unpaid') return a.payment_status !== 'paid';
                if (f.value === 'all') return true;
                return a.payment_status === f.value;
              }).length;
              return (
                <Button
                  key={f.value}
                  variant={statusFilter === f.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter(f.value); setPayoutPage(1); setPayoutSelected(new Set()); }}
                >
                  {f.label} ({count})
                </Button>
              );
            })}
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap mb-3">
            <SearchInput
              value={payoutSearch}
              onChange={(v) => setPayoutSearch(v)}
              placeholder="Search worker..."
            />
            <div className="flex-1" />
            {isAdmin && mpesaEligible.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPayoutSelected((prev) => {
                    const next = new Set(prev);
                    mpesaEligible.forEach((a) => next.add(a.id));
                    return next;
                  });
                }}
              >
                <Smartphone className="mr-1 h-3.5 w-3.5" />
                Select all pending M-Pesa ({mpesaEligible.length})
              </Button>
            )}
          </div>

          {/* Bulk action bar */}
          {isAdmin && payoutSelected.size > 0 && (
            <Card className="border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/50 mb-3">
              <CardContent className="flex items-center gap-4 p-3 flex-wrap">
                <span className="text-sm font-medium">
                  {payoutSelected.size} selected
                  {mpesaSelected.length > 0 && ` — ${mpesaSelected.length} for M-Pesa (${mpesaBulkAmount.toLocaleString()} KES)`}
                  {cashSelected.length > 0 && ` — ${cashSelected.length} cash`}
                </span>
                <Button size="sm" disabled={mpesaSelected.length === 0} onClick={() => setBulkPayOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                  <Send className="mr-2 h-4 w-4" />
                  Pay {mpesaSelected.length} via M-Pesa
                </Button>
                <Button size="sm" variant="outline" disabled={cashSelected.length === 0} onClick={() => setCashBulkOpen(true)}>
                  <Banknote className="mr-2 h-4 w-4" />
                  Mark {cashSelected.length} Paid (Cash)
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setPayoutSelected(new Set())}>Clear</Button>
              </CardContent>
            </Card>
          )}

          {/* Payout table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && (
                    <TableHead className="w-10">
                      <button className="inline-flex items-center justify-center" onClick={() => handleSelectAll(!allChecked)}>
                        {indeterminate ? <MinusSquare className="h-4 w-4" /> : allChecked ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </button>
                    </TableHead>
                  )}
                  <TableHead>Worker</TableHead>
                  <TableHead className="hidden sm:table-cell">Phone</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Payment</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedAdvances.map((a) => {
                  const phone = resolvePhone(a.worker_id, workers);
                  const workerName = resolveName(a.worker_id, workers);
                  const isPaid = a.payment_status === 'paid';
                  const isMpesaPending = a.payment_method === 'mpesa' && a.payment_status === 'pending';
                  const isFailed = a.payment_status === 'failed';
                  const showPay = isMpesaPending || (isFailed && a.payment_method === 'mpesa');
                  const isCashPending = a.payment_method === 'cash' && (a.payment_status === 'pending' || a.payment_status === 'failed');

                  return (
                    <TableRow key={a.id} className={isPaid ? 'opacity-60' : ''}>
                      {isAdmin && (
                        <TableCell>
                          {!isPaid && (
                            <button className="inline-flex items-center justify-center" onClick={() => handleSelectOne(a.id, !payoutSelected.has(a.id))}>
                              {payoutSelected.has(a.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                            </button>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        <p className="font-medium text-sm">{workerName}</p>
                        <p className="text-xs text-muted-foreground">{a.notes || '-'}</p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {phone ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Phone className="h-3 w-3" />{phone}</span>
                        ) : <span className="text-xs text-muted-foreground italic">-</span>}
                      </TableCell>
                      <TableCell className="text-sm">{new Date(a.advance_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</TableCell>
                      <TableCell className="text-right">
                        <span className={`font-bold ${isPaid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {a.amount.toFixed(0)}
                        </span>
                        <span className="text-xs text-muted-foreground ml-0.5">KES</span>
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <PaymentMethodToggle
                            method={a.payment_method}
                            locked={a.payment_status === 'processing' || isPaid}
                            pending={updateAdvancePaymentMethod.isPending}
                            onChange={() => handleToggleMethod(a.id, a.payment_method)}
                          />
                        ) : (
                          <div className="flex items-center gap-1.5 text-sm">
                            {a.payment_method === 'mpesa' ? <Smartphone className="h-3 w-3" /> : <Banknote className="h-3 w-3" />}
                            {a.payment_method === 'mpesa' ? 'M-Pesa' : 'Cash'}
                          </div>
                        )}
                      </TableCell>
                      <TableCell><PaymentStatus status={a.payment_status} /></TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          {showPay && (
                            <Button size="sm" variant={isFailed ? 'outline' : 'default'} className={isFailed ? '' : 'bg-emerald-600 hover:bg-emerald-700'} disabled={mpesaPayAdvance.isPending} onClick={() => setSinglePayTarget(a.id)}>
                              {isFailed ? <RotateCcw className="mr-1 h-3 w-3" /> : <Send className="mr-1 h-3 w-3" />}
                              {isFailed ? 'Retry' : 'Pay'}
                            </Button>
                          )}
                          {isCashPending && (
                            <Button size="sm" variant="outline" className="ml-1" disabled={markAdvanceCashPaid.isPending} onClick={() => setCashPayTarget(a.id)}>
                              <Banknote className="mr-1 h-3 w-3" />Mark Paid
                            </Button>
                          )}
                          {a.payment_status === 'processing' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={resetStuck.isPending}
                              onClick={async () => {
                                try {
                                  const result = await resetStuck.mutateAsync({
                                    entity: 'advance',
                                    entityId: a.id,
                                  });
                                  toast.success(
                                    result.new_status === 'paid'
                                      ? 'Payment actually succeeded — marked paid'
                                      : 'Reset — you can now retry'
                                  );
                                } catch { toast.error('Failed to reset'); }
                              }}
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              Retry
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          {filteredAdvances.length > payoutPageSize && (
            <div className="mt-3">
              <Pagination page={payoutPage} pageSize={payoutPageSize} total={filteredAdvances.length} onChange={setPayoutPage} />
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Advances list */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Advances for {dateLabel}
          </h3>
          {aLoad ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (dailyAdvances ?? []).length === 0 ? (
            <EmptyState
              icon={<Wallet className="h-12 w-12" />}
              title="No advances"
              description={`No advances recorded for ${dateLabel.toLowerCase()}.`}
            />
          ) : (
            <Card className="divide-y">
              {(dailyAdvances ?? []).map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/30">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted flex-shrink-0">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{resolveName(a.worker_id, workers)}</p>
                    {a.notes && (
                      <p className="text-xs text-muted-foreground truncate">{a.notes}</p>
                    )}
                    {a.approved && (
                      <p className="text-xs text-muted-foreground">
                        Approved by {resolveUser(a.approved_by) ?? '—'}
                      </p>
                    )}
                  </div>
                  <span className="font-semibold text-sm flex-shrink-0">{a.amount.toFixed(0)} KES</span>
                  {a.approved && a.payment_status !== 'pending' ? (
                    <Badge variant={a.payment_status === 'paid' ? 'default' : a.payment_status === 'processing' ? 'secondary' : 'destructive'} className="text-xs flex-shrink-0">
                      {a.payment_status === 'paid' ? 'Paid' : a.payment_status === 'processing' ? 'Processing' : 'Failed'}
                    </Badge>
                  ) : (
                    <Badge variant={a.approved ? 'default' : 'secondary'} className="text-xs flex-shrink-0">
                      {a.approved ? 'Approved' : 'Pending'}
                    </Badge>
                  )}
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* Submit form */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            New Advance
          </h3>
          <Card>
            <CardContent className="pt-6">
              {wLoad ? (
                <div className="space-y-3">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Worker</label>
                    <Select
                      value={workerId}
                      onValueChange={(v) => {
                        setWorkerId(v || '');
                        setFormErrors((prev) => {
                          const next = { ...prev };
                          delete next.workerId;
                          return next;
                        });
                      }}
                    >
                      <SelectTrigger
                        className={formErrors.workerId ? 'border-destructive' : ''}
                      >
                        {workerId
                          ? resolveName(Number(workerId), workers)
                          : 'Select worker...'}
                      </SelectTrigger>
                      <SelectContent>
                        {(workers ?? []).map((w) => (
                          <SelectItem key={w.id} value={String(w.id)}>
                            {w.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formErrors.workerId && (
                      <p className="text-xs text-destructive">{formErrors.workerId}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Date</label>
                    <Input
                      type="date"
                      value={advanceDate}
                      onChange={(e) => setAdvanceDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Amount (KES)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="e.g. 500"
                      value={amount}
                      onChange={(e) => {
                        setAmount(e.target.value);
                        if (e.target.value && Number(e.target.value) > 0) {
                          setFormErrors((prev) => {
                            const next = { ...prev };
                            delete next.amount;
                            return next;
                          });
                        }
                      }}
                      className={formErrors.amount ? 'border-destructive' : ''}
                    />
                    {formErrors.amount && (
                      <p className="text-xs text-destructive">{formErrors.amount}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Notes</label>
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Reason for advance"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    {createMutation.isPending ? 'Submitting...' : 'Submit Advance'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Advance Payment Dialogs ── */}

      <Dialog open={singlePayTarget !== null} onOpenChange={() => setSinglePayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Advance M-Pesa Payment</DialogTitle>
            <DialogDescription>
              Pay{' '}
              <strong>
                {singlePayTarget !== null
                  ? resolveName(approvedAdvances.find((a) => a.id === singlePayTarget)?.worker_id ?? 0, workers)
                  : ''}
              </strong>{' '}
              via M-Pesa to{' '}
              <strong>
                {singlePayTarget !== null
                  ? resolvePhone(approvedAdvances.find((a) => a.id === singlePayTarget)?.worker_id ?? 0, workers)
                  : ''}
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>
          {singlePayTarget !== null && (
            <p className="text-2xl font-bold text-center py-2">
              {approvedAdvances.find((a) => a.id === singlePayTarget)?.amount.toFixed(0)} KES
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSinglePayTarget(null)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={mpesaPayAdvance.isPending}
              onClick={() => { if (singlePayTarget !== null) handleSinglePay(singlePayTarget); setSinglePayTarget(null); }}
            >
              {mpesaPayAdvance.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Send Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkPayOpen} onOpenChange={setBulkPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Bulk Advance M-Pesa Payments</DialogTitle>
            <DialogDescription>
              Pay {mpesaSelected.length} advance{mpesaSelected.length !== 1 ? 's' : ''} — total{' '}
              <strong>{mpesaBulkAmount.toLocaleString()} KES</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-52 overflow-y-auto space-y-2 text-sm">
            {mpesaSelected.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b pb-1.5">
                <div>
                  <span className="font-medium">{resolveName(a.worker_id, workers)}</span>
                  <span className="text-xs text-muted-foreground ml-2">{resolvePhone(a.worker_id, workers)}</span>
                </div>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{a.amount.toFixed(0)} KES</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkPayOpen(false)}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleBulkPay} disabled={mpesaBulkPayAdvances.isPending}>
              {mpesaBulkPayAdvances.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Pay {mpesaSelected.length} Advances
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cashPayTarget !== null} onOpenChange={() => setCashPayTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Advance as Paid (Cash)</DialogTitle>
            <DialogDescription>
              Confirm cash payment for{' '}
              <strong>
                {cashPayTarget !== null
                  ? resolveName(approvedAdvances.find((a) => a.id === cashPayTarget)?.worker_id ?? 0, workers)
                  : ''}
              </strong>
              ?
            </DialogDescription>
          </DialogHeader>
          {cashPayTarget !== null && (
            <p className="text-2xl font-bold text-center py-2">
              {approvedAdvances.find((a) => a.id === cashPayTarget)?.amount.toFixed(0)} KES
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCashPayTarget(null)}>Cancel</Button>
            <Button onClick={() => { if (cashPayTarget !== null) handleSingleCashPay(cashPayTarget); setCashPayTarget(null); }} disabled={markAdvanceCashPaid.isPending}>
              {markAdvanceCashPaid.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
              Mark Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cashBulkOpen} onOpenChange={setCashBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Advances as Paid (Cash)</DialogTitle>
            <DialogDescription>
              Mark {cashSelected.length} advance{cashSelected.length !== 1 ? 's' : ''} as paid via cash.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-52 overflow-y-auto space-y-2 text-sm">
            {cashSelected.map((a) => (
              <div key={a.id} className="flex items-center justify-between border-b pb-1.5">
                <div><span className="font-medium">{resolveName(a.worker_id, workers)}</span></div>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{a.amount.toFixed(0)} KES</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCashBulkOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkCashPay} disabled={bulkMarkAdvanceCashPaid.isPending}>
              {bulkMarkAdvanceCashPaid.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
              Mark {cashSelected.length} Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
