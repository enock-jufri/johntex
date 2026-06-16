import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../api/client';

export interface Product {
  id: number;
  name: string;
  unit_price: number;
  currency: string;
  tax_rate: number;
  active: boolean;
}

export function useProducts(activeOnly = true) {
  return useQuery({
    queryKey: ['products', activeOnly],
    queryFn: async () => {
      const { data } = await api.get<Product[]>(`/products/?active=${activeOnly}`);
      return data;
    },
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (product: { name: string; unit_price: number }) => {
      const { data } = await api.post('/products/', product);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
    onError: (err: Error) => toast.error(err.message || 'Failed to create product'),
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...product }: { id: number; name?: string; unit_price?: number }) => {
      const { data } = await api.put(`/products/${id}`, product);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
    onError: (err: Error) => toast.error(err.message || 'Failed to update product'),
  });
}
