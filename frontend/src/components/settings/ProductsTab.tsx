import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useProducts, useCreateProduct, useUpdateProduct } from '../../hooks/useProducts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import SearchInput from '../ui/SearchInput';
import Pagination from '../ui/Pagination';
import EmptyState from '../ui/EmptyState';
import { Shirt, Plus, Check, X } from 'lucide-react';
import type { AxiosError } from 'axios';

const pageSize = 8;

function Skeletons({ n }: { n: number }) {
  return <div className="space-y-2">{Array.from({ length: n }, (_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
}

export default function ProductsTab() {
  const { data: products, isLoading } = useProducts();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(q));
  }, [products, search]);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;
    try {
      await createProduct.mutateAsync({ name, unit_price: Number(price) });
      toast.success('Product created');
      setName(''); setPrice('');
    } catch (err) {
      const msg = (err as AxiosError<{ detail: string }>)?.response?.data?.detail;
      toast.error(msg || 'Failed to create product');
    }
  };

  const handleUpdate = async () => {
    if (editingId === null) return;
    try {
      await updateProduct.mutateAsync({ id: editingId, name: editName, unit_price: Number(editPrice) });
      toast.success('Updated');
      setEditingId(null);
    } catch (err) {
      const msg = (err as AxiosError<{ detail: string }>)?.response?.data?.detail;
      toast.error(msg || 'Failed to update product');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Add Garment</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row items-end gap-3">
            <div className="space-y-1 flex-1">
              <label className="text-sm font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wedding Dress" required />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Piece Rate (KES)</label>
              <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="500" required className="w-32" />
            </div>
            <Button type="submit" size="sm" disabled={createProduct.isPending}><Plus className="mr-1 h-4 w-4" /> Add</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base flex items-center gap-2"><Shirt className="h-4 w-4" /> Garments ({filtered.length})</CardTitle>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search..." />
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeletons n={4} /> : filtered.length === 0 ? (
            <EmptyState icon={<Shirt className="h-12 w-12" />} title="No garments" description={search ? 'No match.' : 'Add one above.'} />
          ) : (
            <div className="divide-y">
              {paged.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-3">
                  {editingId === p.id ? (
                    <>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1" />
                      <Input type="number" step="0.01" min="0" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-28" />
                      <Button size="sm" variant="ghost" onClick={handleUpdate} disabled={updateProduct.isPending}><Check className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.unit_price.toFixed(2)} KES / piece</p>
                      </div>
                      <Badge variant={p.active ? 'default' : 'destructive'} className="text-xs">{p.active ? 'Active' : 'Inactive'}</Badge>
                      <Button size="sm" variant="outline" onClick={() => { setEditingId(p.id); setEditName(p.name); setEditPrice(String(p.unit_price)); }}>Edit</Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          {filtered.length > pageSize && <Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} />}
        </CardContent>
      </Card>
    </div>
  );
}
