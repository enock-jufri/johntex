import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

export interface Advance {
  id: number;
  worker_id: number;
  advance_date: string;
  amount: number;
  currency: string;
  notes: string | null;
  approved: boolean;
  approved_by: number | null;
  payment_method: string;
  payment_status: string;
  paid_at: string | null;
}

export function useAdvances(
  approved?: boolean,
  startDate?: string,
  endDate?: string,
  paymentStatus?: string,
  workerId?: number,
) {
  const params = new URLSearchParams();
  if (approved !== undefined) params.set('approved', String(approved));
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  if (paymentStatus) params.set('payment_status', paymentStatus);
  if (workerId) params.set('worker_id', String(workerId));
  const qs = params.toString();
  return useQuery({
    queryKey: ['advances', approved, startDate, endDate, paymentStatus, workerId],
    queryFn: async () => {
      const { data } = await api.get<Advance[]>(`/advances/${qs ? `?${qs}` : ''}`);
      return data;
    },
    refetchInterval: (query) => {
      const hasProcessing = (query.state.data as Advance[] | undefined)?.some(
        (a) => a.payment_status === 'processing',
      );
      return hasProcessing ? 5000 : false;
    },
  });
}

export function useCreateAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (advance: {
      worker_id: number;
      advance_date: string;
      amount: number;
      notes?: string;
    }) => {
      const { data } = await api.post('/advances/', advance);
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['advances'] });
      qc.invalidateQueries({ queryKey: ['wallet', variables.worker_id] });
    },
  });
}

export function useApproveAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.put(`/advances/${id}/approve`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advances'] });
    },
  });
}
