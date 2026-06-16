import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useWorkers } from '../hooks/useWorkers';
import { useProductionLogs } from '../hooks/useProductionLogs';
import { useAdvances } from '../hooks/useAdvances';
import { usePayrolls } from '../hooks/usePayroll';
import { useProducts } from '../hooks/useProducts';
import { useWorkerWallet } from '../hooks/useWallet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import EmptyState from '../components/ui/EmptyState';
import WorkerProductionChart from '../components/workers/WorkerProductionChart';
import WorkerEarningsChart from '../components/workers/WorkerEarningsChart';
import WorkerPayrollChart from '../components/workers/WorkerPayrollChart';
import WorkerGarmentChart from '../components/workers/WorkerGarmentChart';
import {
  ArrowLeft, Phone, Wallet, TrendingUp, TrendingDown,
  ArrowDownToLine, ArrowUpRight, ArrowDownRight,
  CheckCircle, Scissors, DollarSign, Calendar, AlertCircle,
} from 'lucide-react';

function resolveName(id: number, items: { id: number; name: string }[] | undefined): string {
  return items?.find((i) => i.id === id)?.name ?? `#${id}`;
}

function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (/^07\d{8}$/.test(cleaned)) return `+254 ${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  if (/^\+254\d{9}$/.test(cleaned)) return `+254 ${cleaned.slice(4, 7)} ${cleaned.slice(7, 10)} ${cleaned.slice(10)}`;
  if (/^254\d{9}$/.test(cleaned)) return `+254 ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
  return phone;
}

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

export default function WorkerDetail() {
  const { workerId } = useParams<{ workerId: string }>();
  const id = Number(workerId);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('production');
  const { data: workers } = useWorkers();
  const { data: products } = useProducts();
  const { data: logs, isLoading: logsLoading } = useProductionLogs(undefined, undefined, undefined, id);
  const { data: advances, isLoading: advancesLoading } = useAdvances(undefined, undefined, undefined, undefined, id);
  const { data: payrolls, isLoading: payrollsLoading } = usePayrolls(id);
  const { data: wallet, isLoading: walletLoading } = useWorkerWallet(id);

  const worker = workers?.find((w) => w.id === id);

  const sortedLogs = useMemo(() => [...(logs ?? [])].sort((a, b) => b.id - a.id), [logs]);
  const sortedAdvances = useMemo(() => [...(advances ?? [])].sort((a, b) => b.id - a.id), [advances]);
  const sortedPayrolls = useMemo(() => [...(payrolls ?? [])].sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime()), [payrolls]);

  const logStats = useMemo(() => {
    if (!logs) return { total: 0, pieces: 0, approved: 0, rate: 0 };
    return {
      total: logs.reduce((s, l) => s + l.amount, 0),
      pieces: logs.reduce((s, l) => s + l.quantity, 0),
      approved: logs.filter((l) => l.approved).length,
      rate: logs.length > 0 ? Math.round((logs.filter((l) => l.approved).length / logs.length) * 100) : 0,
    };
  }, [logs]);

  const advanceStats = useMemo(() => {
    if (!advances) return { total: 0, count: 0, pending: 0, processing: 0 };
    return {
      total: advances.reduce((s, a) => s + a.amount, 0),
      count: advances.length,
      pending: advances.filter((a) => a.payment_status === 'pending').length,
      processing: advances.filter((a) => a.payment_status === 'processing').length,
    };
  }, [advances]);

  const payrollStats = useMemo(() => {
    if (!payrolls) return { gross: 0, net: 0, deductions: 0, lastDate: '' };
    return {
      gross: payrolls.reduce((s, p) => s + p.gross_pay, 0),
      net: payrolls.reduce((s, p) => s + p.net_pay, 0),
      deductions: payrolls.reduce((s, p) => s + p.total_advances, 0),
      lastDate: payrolls.length > 0 ? payrolls.sort((a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime())[0]?.week_start || '' : '',
    };
  }, [payrolls]);

  if (!worker) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <EmptyState icon={<Scissors className="h-12 w-12" />} title="Worker not found" description="This worker may have been removed." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Link to="/workers" className="hover:text-foreground transition-colors">Workers</Link>
        <span>/</span>
        <span className="text-foreground">{worker.name}</span>
      </div>

      {/* Profile Header */}
      <div className="flex items-start gap-5 flex-wrap">
        <Avatar className={`h-16 w-16 flex-shrink-0 ${worker.active ? 'ring-4 ring-emerald-500/20' : 'ring-4 ring-gray-300 dark:ring-gray-700'}`}>
          <AvatarFallback className={`text-2xl font-bold ${worker.active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
            {worker.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{worker.name}</h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
            <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{formatPhoneDisplay(worker.phone)}</span>
            <Badge variant={worker.active ? 'default' : 'destructive'} className="text-xs">{worker.active ? 'Active' : 'Inactive'}</Badge>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {(() => {
          const totalPaidOut = (wallet?.total_advanced ?? 0) + (wallet?.total_paid ?? 0);
          return [
            { label: 'Total Earned', value: `${(wallet?.total_earned ?? 0).toLocaleString()} KES`, icon: <TrendingUp className="h-4 w-4" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
            { label: 'Advances Taken', value: `${(wallet?.total_advanced ?? 0).toLocaleString()} KES`, icon: <ArrowDownRight className="h-4 w-4" />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
            { label: 'Total Paid Out', value: `${totalPaidOut.toLocaleString()} KES`, icon: <ArrowDownToLine className="h-4 w-4" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
            { label: 'Wallet Balance', value: `${(wallet?.balance ?? 0).toLocaleString()} KES`, icon: <Wallet className="h-4 w-4" />, color: (wallet?.balance ?? 0) >= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400', bg: (wallet?.balance ?? 0) >= 0 ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-red-50 dark:bg-red-950/30' },
          ];
        })().map((s) => (
          <div key={s.label} className={`flex items-center gap-3 p-4 rounded-xl ${s.bg}`}>
            <span className={s.color}>{s.icon}</span>
            <div>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-sm font-bold ${s.color}`}>
                {walletLoading ? '...' : s.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 lg:grid-cols-2">
        <WorkerProductionChart logs={logs} isLoading={logsLoading} />
        <WorkerEarningsChart wallet={wallet} isLoading={walletLoading} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <WorkerPayrollChart payrolls={payrolls} isLoading={payrollsLoading} />
        <WorkerGarmentChart logs={logs} products={products} isLoading={logsLoading} />
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
        {[
          { id: 'production', label: 'Production', count: sortedLogs.length, icon: <Scissors className="h-3.5 w-3.5" /> },
          { id: 'advances', label: 'Advances', count: sortedAdvances.length, icon: <DollarSign className="h-3.5 w-3.5" /> },
          { id: 'payroll', label: 'Payroll', count: sortedPayrolls.length, icon: <Calendar className="h-3.5 w-3.5" /> },
          { id: 'ledger', label: 'Ledger', count: wallet?.transactions?.length ?? 0, icon: <Wallet className="h-3.5 w-3.5" /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
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

      <div className="mt-4">
        {/* Production Tab */}
        {activeTab === 'production' && (
          logsLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : sortedLogs.length === 0 ? (
            <EmptyState icon={<Scissors className="h-12 w-12" />} title="No production" description="No production entries yet." />
          ) : (
            <>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
                {[
                  { label: 'Total Value', value: `${logStats.total.toLocaleString()} KES`, icon: <DollarSign className="h-4 w-4" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
                  { label: 'Total Pieces', value: logStats.pieces, icon: <Scissors className="h-4 w-4" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
                  { label: 'Approved', value: `${logStats.approved}/${sortedLogs.length}`, icon: <CheckCircle className="h-4 w-4" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
                  { label: 'Approval Rate', value: `${logStats.rate}%`, icon: <TrendingUp className="h-4 w-4" />, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30' },
                ].map((s) => (
                  <div key={s.label} className={`flex items-center gap-3 p-4 rounded-xl ${s.bg}`}>
                    <span className={s.color}>{s.icon}</span>
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedLogs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="text-sm">{new Date(l.production_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: '2-digit' })}</TableCell>
                        <TableCell className="text-sm">{resolveName(l.product_id, products)}</TableCell>
                        <TableCell className="text-right text-sm">{l.quantity}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{l.amount.toFixed(0)} KES</TableCell>
                        <TableCell><Badge variant={l.approved ? 'default' : 'secondary'} className="text-xs">{l.approved ? 'Approved' : 'Pending'}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          ))}

        {/* Advances Tab */}
        {activeTab === 'advances' && (
          advancesLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : sortedAdvances.length === 0 ? (
            <EmptyState icon={<DollarSign className="h-12 w-12" />} title="No advances" description="No advance requests yet." />
          ) : (
            <>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
                {[
                  { label: 'Total Advanced', value: `${advanceStats.total.toLocaleString()} KES`, icon: <ArrowDownRight className="h-4 w-4" />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
                  { label: 'Total Count', value: advanceStats.count, icon: <DollarSign className="h-4 w-4" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
                  { label: 'Pending', value: advanceStats.pending, icon: <AlertCircle className="h-4 w-4" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
                  { label: 'Processing', value: advanceStats.processing, icon: <TrendingDown className="h-4 w-4" />, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30' },
                ].map((s) => (
                  <div key={s.label} className={`flex items-center gap-3 p-4 rounded-xl ${s.bg}`}>
                    <span className={s.color}>{s.icon}</span>
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Payment</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAdvances.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm">{new Date(a.advance_date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: '2-digit' })}</TableCell>
                        <TableCell className="text-right text-sm font-medium text-red-600">{a.amount.toFixed(0)} KES</TableCell>
                        <TableCell className="text-sm capitalize">{a.payment_method}</TableCell>
                        <TableCell><PaymentStatus status={a.payment_status} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground">{a.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          ))}

        {/* Payroll Tab */}
        {activeTab === 'payroll' && (
          payrollsLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : sortedPayrolls.length === 0 ? (
            <EmptyState icon={<Calendar className="h-12 w-12" />} title="No payroll" description="No payroll runs yet." />
          ) : (
            <>
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-4">
                {[
                  { label: 'Total Gross', value: `${payrollStats.gross.toLocaleString()} KES`, icon: <TrendingUp className="h-4 w-4" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
                  { label: 'Total Net', value: `${payrollStats.net.toLocaleString()} KES`, icon: <Wallet className="h-4 w-4" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
                  { label: 'Deductions', value: `${payrollStats.deductions.toLocaleString()} KES`, icon: <ArrowDownRight className="h-4 w-4" />, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30' },
                  { label: 'Last Pay Date', value: payrollStats.lastDate ? new Date(payrollStats.lastDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) : '-', icon: <Calendar className="h-4 w-4" />, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30' },
                ].map((s) => (
                  <div key={s.label} className={`flex items-center gap-3 p-4 rounded-xl ${s.bg}`}>
                    <span className={s.color}>{s.icon}</span>
                    <div>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Week</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Advances</TableHead>
                      <TableHead className="text-right">Net Pay</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Payment</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPayrolls.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{p.week_start}</TableCell>
                        <TableCell className="text-right text-sm">{p.gross_pay.toFixed(0)} KES</TableCell>
                        <TableCell className="text-right text-sm text-red-600">-{p.total_advances.toFixed(0)} KES</TableCell>
                        <TableCell className="text-right text-sm font-bold text-emerald-600">{p.net_pay.toFixed(0)} KES</TableCell>
                        <TableCell className="text-sm capitalize">{p.payment_method}</TableCell>
                        <TableCell><PaymentStatus status={p.payment_status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          ))}

        {/* Ledger Tab */}
        {activeTab === 'ledger' && (
          walletLoading ? (
            <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !wallet?.transactions?.length ? (
            <EmptyState icon={<Wallet className="h-12 w-12" />} title="No transactions" description="Transactions appear when production is approved or advances are created." />
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wallet.transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{new Date(t.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: '2-digit' })}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          t.type === 'earning' ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400' :
                          t.type === 'advance' ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400' :
                          'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                        }`}>
                          {t.type === 'earning' ? <ArrowUpRight className="h-3 w-3" /> :
                           t.type === 'advance' ? <ArrowDownRight className="h-3 w-3" /> :
                           <ArrowDownToLine className="h-3 w-3" />}
                          {t.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.description || '-'}</TableCell>
                      <TableCell className={`text-right text-sm font-medium ${t.type === 'earning' ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.type === 'earning' ? '+' : '-'}{t.amount.toFixed(0)} KES
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))}
      </div>
    </div>
  );
}
