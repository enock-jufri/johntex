import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

export interface ProductionLog {
  id: number;
  worker_id: number;
  product_id: number;
  production_date: string;
  quantity: number;
  amount: number;
  notes: string | null;
  approved: boolean;
  approved_by: number | null;
}

export function useProductionLogs(approved?: boolean, startDate?: string, endDate?: string, workerId?: number) {
  const params = new URLSearchParams();
  if (approved !== undefined) params.set('approved', String(approved));
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  if (workerId) params.set('worker_id', String(workerId));
  const qs = params.toString();
  return useQuery({
    queryKey: ['productionLogs', approved, startDate, endDate, workerId],
    queryFn: async () => {
      const { data } = await api.get<ProductionLog[]>(`/production/${qs ? `?${qs}` : ''}`);
      return data;
    },
  });
}

export function useCreateProductionLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      worker_id: number;
      product_id: number;
      production_date: string;
      quantity: number;
      amount: number;
      notes?: string;
    }) => {
      const { data } = await api.post('/production/', entry);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['productionLogs'] });
    },
  });
}

export function useApproveProductionLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.put(`/production/${id}/approve`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['productionLogs'] });
    },
  });
}
