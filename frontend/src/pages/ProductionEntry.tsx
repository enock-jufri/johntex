import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useWorkers } from '../hooks/useWorkers';
import { useProducts } from '../hooks/useProducts';
import { useProductionLogs, useCreateProductionLog } from '../hooks/useProductionLogs';
import { useUsers } from '../hooks/useUsers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import SearchInput from '../components/ui/SearchInput';
import Pagination from '../components/ui/Pagination';
import EmptyState from '../components/ui/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Receipt, DollarSign, Scissors, Users, Calendar, CheckCircle } from 'lucide-react';

function today() { return new Date().toISOString().slice(0, 10); }

function resolveName(id: number, items: { id: number; name: string }[] | undefined): string {
  return items?.find((i) => i.id === id)?.name ?? `#${id}`;
}

export default function ProductionEntry() {
  const { data: workers } = useWorkers();
  const { data: products } = useProducts();
  const { data: users } = useUsers();
  const [filterDate, setFilterDate] = useState(today());
  const { data: logs, isLoading } = useProductionLogs(undefined, filterDate, filterDate);
  const createMutation = useCreateProductionLog();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    if (!logs) return [];
    const q = search.toLowerCase();
    return logs.filter((l) =>
      resolveName(l.worker_id, workers).toLowerCase().includes(q) ||
      resolveName(l.product_id, products).toLowerCase().includes(q)
    );
  }, [logs, workers, products, search]);

  const paged = filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

  const stats = useMemo(() => {
    const items = filtered;
    return {
      revenue: items.reduce((s, l) => s + l.amount, 0),
      pieces: items.reduce((s, l) => s + l.quantity, 0),
      workers: new Set(items.map((l) => l.worker_id)).size,
      count: items.length,
      approved: items.filter((l) => l.approved).length,
    };
  }, [filtered]);

  const resolveUser = (id: number | null) =>
    id ? users?.find((u) => u.id === id)?.username ?? `#${id}` : null;

  const [workerId, setWorkerId] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [entryDate, setEntryDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const calcAmount = () => {
    const p = products?.find((p) => p.id === Number(productId));
    return p && quantity ? Number(quantity) * p.unit_price : 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!workerId) errs.workerId = 'Required';
    if (!productId) errs.productId = 'Required';
    if (!quantity || Number(quantity) < 1) errs.quantity = 'Must be ≥ 1';
    setFormErrors(errs);
    if (Object.keys(errs).length) return;

    try {
      await createMutation.mutateAsync({
        worker_id: Number(workerId),
        product_id: Number(productId),
        production_date: entryDate,
        quantity: Number(quantity),
        amount: calcAmount(),
        notes: notes || undefined,
      });
      toast.success('Production log saved');
      setWorkerId(''); setProductId(''); setQuantity(''); setEntryDate(today()); setNotes('');
    } catch { toast.error('Failed to save'); }
  };

  const dateLabel = filterDate === today()
    ? 'Today'
    : new Date(filterDate).toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Production</h2>
          <p className="text-muted-foreground text-sm">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
            className="w-44"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: 'Revenue', value: `${stats.revenue.toLocaleString()} KES`, icon: <DollarSign className="h-4 w-4 text-blue-500" /> },
          { label: 'Pieces', value: stats.pieces, icon: <Scissors className="h-4 w-4 text-green-500" /> },
          { label: 'Workers', value: stats.workers, icon: <Users className="h-4 w-4 text-purple-500" /> },
          { label: 'Entries', value: stats.count, icon: <Receipt className="h-4 w-4 text-amber-500" /> },
          { label: 'Approved', value: `${stats.approved}/${stats.count}`, icon: <CheckCircle className="h-4 w-4 text-rose-500" /> },
        ].map((s) => (
          <Card key={s.label} className="transition hover:shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                {s.icon}
              </div>
              <p className="text-lg font-bold">{isLoading ? '—' : s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New entry form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> New Production Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 sm:flex sm:flex-row items-end gap-3">
            <div className="space-y-1 col-span-2 sm:flex-1">
              <label className="text-sm font-medium">Worker</label>
              <Select value={workerId} onValueChange={(v) => setWorkerId(v || '')}>
                <SelectTrigger className={formErrors.workerId ? 'border-destructive' : ''}>
                  {workerId ? resolveName(Number(workerId), workers) : 'Select worker...'}
                </SelectTrigger>
                <SelectContent>
                  {(workers ?? []).map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.workerId && <p className="text-xs text-destructive">{formErrors.workerId}</p>}
            </div>

            <div className="space-y-1 col-span-2 sm:flex-1">
              <label className="text-sm font-medium">Product</label>
              <Select value={productId} onValueChange={(v) => setProductId(v || '')}>
                <SelectTrigger className={formErrors.productId ? 'border-destructive' : ''}>
                  {productId ? (() => { const p = products?.find((p) => p.id === Number(productId)); return p ? `${p.name} (${p.unit_price} KES)` : 'Select product...'; })() : 'Select product...'}
                </SelectTrigger>
                <SelectContent>
                  {(products ?? []).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.unit_price} KES)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.productId && <p className="text-xs text-destructive">{formErrors.productId}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Date</label>
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="w-full sm:w-36" />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Quantity</label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={`w-full sm:w-24 ${formErrors.quantity ? 'border-destructive' : ''}`} />
              {formErrors.quantity && <p className="text-xs text-destructive">{formErrors.quantity}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Notes</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="w-full sm:w-32" />
            </div>

            <div className="flex items-end gap-3">
              <p className="text-sm font-medium pb-2 whitespace-nowrap">
                {calcAmount().toFixed(2)} KES
              </p>
              <Button type="submit" size="sm" disabled={createMutation.isPending}>
                <Receipt className="mr-1 h-4 w-4" /> Save
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* List header */}
      <div className="max-w-xs">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search production..." />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Receipt className="h-12 w-12" />} title="No entries" description={search ? 'No entries match.' : 'Add your first production entry above.'} />
      ) : (
        <>
          <Card className="divide-y">
            {paged.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/30">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted flex-shrink-0">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{resolveName(l.worker_id, workers)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {resolveName(l.product_id, products)} &middot; {l.quantity} pcs &middot; <span className="font-medium text-foreground">{l.amount.toFixed(0)} KES</span>
                    {l.notes && <span className="ml-1 text-xs">&mdash; {l.notes}</span>}
                    {l.approved && l.approved_by && (
                      <span className="ml-1 text-xs"> &middot; approved by {resolveUser(l.approved_by)}</span>
                    )}
                  </p>
                </div>
                <Badge variant={l.approved ? 'default' : 'secondary'} className="text-xs flex-shrink-0">
                  {l.approved ? 'Approved' : 'Pending'}
                </Badge>
              </div>
            ))}
          </Card>
          <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />
        </>
      )}
    </div>
  );
}
