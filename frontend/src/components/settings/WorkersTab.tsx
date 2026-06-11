import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useWorkers, useCreateWorker, useUpdateWorker, useDeleteWorker } from '../../hooks/useWorkers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import SearchInput from '../ui/SearchInput';
import Pagination from '../ui/Pagination';
import EmptyState from '../ui/EmptyState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Check, X, Users, User, Phone, Trash2, Loader2 } from 'lucide-react';
import type { AxiosError } from 'axios';

const pageSize = 8;

function Skeletons({ n }: { n: number }) {
  return <div className="space-y-2">{Array.from({ length: n }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
}

function validatePhone(phone: string): string | null {
  if (!phone.trim()) return 'Phone number is required';
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (!cleaned) return 'Phone number is required';
  if (/^07\d{8}$/.test(cleaned)) return null;
  if (/^\+?254\d{9}$/.test(cleaned)) return null;
  return 'Must be a valid Kenyan number (e.g. 0712345678)';
}

function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (/^07\d{8}$/.test(cleaned))
    return `+254 ${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  if (/^\+254\d{9}$/.test(cleaned))
    return `+254 ${cleaned.slice(4, 7)} ${cleaned.slice(7, 10)} ${cleaned.slice(10)}`;
  if (/^254\d{9}$/.test(cleaned))
    return `+254 ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
  return phone;
}

export default function WorkersTab() {
  const { data: workers, isLoading } = useWorkers();
  const createWorker = useCreateWorker();
  const updateWorker = useUpdateWorker();
  const deleteWorker = useDeleteWorker();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editPhoneError, setEditPhoneError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const filtered = useMemo(() => {
    if (!workers) return [];
    const q = search.toLowerCase();
    return workers.filter((w) => w.name.toLowerCase().includes(q) || w.phone.includes(q));
  }, [workers, search]);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    setPhoneError(value ? validatePhone(value) : null);
  };

  const handleEditPhoneChange = (value: string) => {
    setEditPhone(value);
    setEditPhoneError(value ? validatePhone(value) : null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    const err = validatePhone(phone);
    if (err) { setPhoneError(err); return; }
    try {
      await createWorker.mutateAsync({ name, phone });
      toast.success('Worker added');
      setName(''); setPhone(''); setPhoneError(null);
    } catch (err) {
      const msg = (err as AxiosError<{ detail: string }>)?.response?.data?.detail;
      toast.error(msg || 'Failed to create worker');
    }
  };

  const handleUpdate = async () => {
    if (editingId === null) return;
    const err = validatePhone(editPhone);
    if (err) { setEditPhoneError(err); return; }
    try {
      await updateWorker.mutateAsync({ id: editingId, name: editName, phone: editPhone });
      toast.success('Updated');
      setEditingId(null); setEditPhoneError(null);
    } catch (err) {
      const msg = (err as AxiosError<{ detail: string }>)?.response?.data?.detail;
      toast.error(msg || 'Failed to update worker');
    }
  };

  const handleToggleActive = async (id: number, active: boolean) => {
    try {
      await updateWorker.mutateAsync({ id, active: !active });
      toast.success(active ? 'Worker deactivated' : 'Worker reactivated');
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async () => {
    if (deleteTarget === null) return;
    try {
      await deleteWorker.mutateAsync(deleteTarget);
      toast.success('Worker removed');
      setDeleteTarget(null);
    } catch (err) {
      const msg = (err as AxiosError<{ detail: string }>)?.response?.data?.detail;
      toast.error(msg || 'Failed to remove worker');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Add Worker</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
            <div className="space-y-1 flex-1">
              <label className="text-sm font-medium">Full Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. James Mwangi" required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="0712 345 678"
                className={`w-44 ${phoneError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                required
              />
              {phoneError && <p className="text-xs text-destructive">{phoneError}</p>}
              {phone && !phoneError && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Check className="h-3 w-3" />{formatPhoneDisplay(phone)}
                </p>
              )}
            </div>
            <Button type="submit" size="sm" disabled={createWorker.isPending || (!!phone && !!phoneError)}>
              <Plus className="mr-1 h-4 w-4" /> Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Workers ({filtered.length})</CardTitle>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search..." />
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeletons n={4} /> : filtered.length === 0 ? (
            <EmptyState icon={<Users className="h-12 w-12" />} title="No workers" description={search ? 'No match.' : 'Add one above.'} />
          ) : (
            <div className="divide-y">
              {paged.map((w) => (
                <div key={w.id} className="flex items-center gap-3 py-3">
                  {editingId === w.id ? (
                    <>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1" />
                      <div className="space-y-1">
                        <Input value={editPhone} onChange={(e) => handleEditPhoneChange(e.target.value)} className={`w-44 ${editPhoneError ? 'border-destructive focus-visible:ring-destructive' : ''}`} />
                        {editPhoneError && <p className="text-xs text-destructive">{editPhoneError}</p>}
                        {editPhone && !editPhoneError && (
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <Check className="h-3 w-3" />{formatPhoneDisplay(editPhone)}
                          </p>
                        )}
                      </div>
                      <Button size="sm" variant="ghost" onClick={handleUpdate} disabled={updateWorker.isPending || !!editPhoneError}><Check className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditPhoneError(null); }}><X className="h-4 w-4" /></Button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-center h-9 w-9 rounded-full bg-muted flex-shrink-0">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link to={`/workers/${w.id}`} className="font-medium text-sm hover:text-primary hover:underline">{w.name}</Link>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {formatPhoneDisplay(w.phone)}</p>
                      </div>
                      <Badge variant={w.active ? 'default' : 'destructive'} className="text-xs">{w.active ? 'Active' : 'Inactive'}</Badge>
                      <Button size="sm" variant="outline" onClick={() => { setEditingId(w.id); setEditName(w.name); setEditPhone(w.phone); setEditPhoneError(null); }}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleToggleActive(w.id, w.active)}>{w.active ? 'Deactivate' : 'Activate'}</Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(w.id)}><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          {filtered.length > pageSize && <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />}
        </CardContent>
      </Card>

      <Dialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Worker</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently remove <strong>{workers?.find((w) => w.id === deleteTarget)?.name}</strong>?
              This worker must have no production history to be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteWorker.isPending}>
              {deleteWorker.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
