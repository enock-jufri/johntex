import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/client';

export interface Payroll {
  id: number;
  worker_id: number;
  week_start: string;
  gross_pay: number;
  total_advances: number;
  total_deductions: number;
  net_pay: number;
  processed: boolean;
  payment_method: string;
  payment_status: string;
  paid_at: string | null;
}

export function usePayrolls(workerId?: number) {
  const params = new URLSearchParams();
  if (workerId) params.set('worker_id', String(workerId));
  const qs = params.toString();
  return useQuery({
    queryKey: ['payrolls', workerId],
    queryFn: async () => {
      const { data } = await api.get<Payroll[]>(`/payroll/${qs ? `?${qs}` : ''}`);
      return data;
    },
    refetchInterval: (query) => {
      const hasProcessing = (query.state.data as Payroll[] | undefined)?.some(
        (p) => p.payment_status === 'processing',
      );
      return hasProcessing ? 5000 : false;
    },
  });
}

export function useRunPayroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      weekStart,
      paymentMethod = 'cash',
    }: {
      weekStart: string;
      paymentMethod?: string;
    }) => {
      const { data } = await api.post(
        `/payroll/run?week_start=${weekStart}&payment_method=${paymentMethod}`
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payrolls'] });
    },
  });
}
