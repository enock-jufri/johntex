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
import { Shirt, Plus, Check, X, Save } from 'lucide-react';
import type { AxiosError } from 'axios';

const pageSize = 8;

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
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-r from-primary/[0.02] to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Add Garment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid grid-cols-2 sm:flex sm:flex-row items-end gap-3">
            <div className="space-y-1 col-span-2 sm:flex-1">
              <label className="text-xs font-medium">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wedding Dress" required />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Piece Rate (KES)</label>
              <Input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="500" required className="w-full sm:w-32" />
            </div>
            <Button type="submit" size="sm" disabled={createProduct.isPending}>
              <Save className="mr-1 h-3.5 w-3.5" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shirt className="h-4 w-4 text-primary" />
            Garments
            <span className="text-xs font-normal text-muted-foreground">({filtered.length})</span>
          </CardTitle>
          <div className="w-full sm:w-48">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search..." />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Shirt className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium text-muted-foreground">{search ? 'No match found' : 'No garments yet'}</p>
              <p className="text-xs text-muted-foreground mt-1">{search ? 'Try a different term.' : 'Add one using the form above.'}</p>
            </div>
          ) : (
            <div className="divide-y">
              {paged.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-3">
                  {editingId === p.id ? (
                    <>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1" />
                      <Input type="number" step="0.01" min="0" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} className="w-24" />
                      <Button size="sm" variant="ghost" onClick={handleUpdate} disabled={updateProduct.isPending} aria-label="Save changes"><Check className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} aria-label="Cancel editing"><X className="h-4 w-4" /></Button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/5 shrink-0">
                        <Shirt className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.unit_price.toFixed(2)} KES / piece</p>
                      </div>
                      <Badge variant={p.active ? 'default' : 'destructive'} className="text-[10px] h-5">{p.active ? 'Active' : 'Inactive'}</Badge>
                      <Button size="sm" variant="outline" onClick={() => { setEditingId(p.id); setEditName(p.name); setEditPrice(String(p.unit_price)); }}>Edit</Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          {filtered.length > pageSize && <div className="mt-4"><Pagination page={page} pageSize={pageSize} total={filtered.length} onChange={setPage} /></div>}
        </CardContent>
      </Card>
    </div>
  );
}
