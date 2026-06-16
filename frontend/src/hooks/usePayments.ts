import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../api/client';

export interface MpesaTransaction {
  id: number;
  payroll_id: number;
  worker_id: number;
  amount: number;
  phone: string;
  conversation_id: string | null;
  originator_conversation_id: string | null;
  response_code: string | null;
  response_description: string | null;
  result_code: number | null;
  result_description: string | null;
  transaction_id: string | null;
  status: string;
  retry_count: number;
  created_at: string;
  updated_at: string | null;
}

export interface MpesaSettings {
  environment: string;
  base_url: string;
  shortcode: string;
  initiator_name: string;
  consumer_key_set: boolean;
  consumer_secret_set: boolean;
  security_credential_set: boolean;
}

export function useMpesaPay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payrollId: number) => {
      const { data } = await api.post(`/payments/mpesa/pay/${payrollId}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payrolls'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (err: Error) => toast.error(err.message || 'M-Pesa payment failed'),
  });
}

export function useMpesaBulkPay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payrollIds: number[]) => {
      const { data } = await api.post('/payments/mpesa/bulk-pay', {
        payroll_ids: payrollIds,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payrolls'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Bulk M-Pesa payment failed'),
  });
}

export function useTransactions(payrollId?: number) {
  return useQuery({
    queryKey: ['transactions', payrollId],
    queryFn: async () => {
      const url = payrollId
        ? `/payments/transactions?payroll_id=${payrollId}`
        : '/payments/transactions';
      const { data } = await api.get<MpesaTransaction[]>(url);
      return data;
    },
  });
}

export function useMpesaSettings() {
  return useQuery({
    queryKey: ['mpesa-settings'],
    queryFn: async () => {
      const { data } = await api.get<MpesaSettings>(
        '/payments/mpesa-settings'
      );
      return data;
    },
  });
}

export interface MpesaSettingsUpdate {
  shortcode?: string;
  initiator_name?: string;
}

export function useUpdateMpesaSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (settings: MpesaSettingsUpdate) => {
      const { data } = await api.put('/payments/mpesa-settings', settings);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mpesa-settings'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update M-Pesa settings'),
  });
}

export function useMarkCashPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payrollId: number) => {
      const { data } = await api.post(`/payments/cash/pay/${payrollId}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payrolls'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to mark cash paid'),
  });
}

export function useBulkMarkCashPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payrollIds: number[]) => {
      const { data } = await api.post('/payments/cash/bulk-pay', {
        payroll_ids: payrollIds,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payrolls'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Bulk cash payment failed'),
  });
}

export function useUpdatePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      payrollId,
      paymentMethod,
    }: {
      payrollId: number;
      paymentMethod: string;
    }) => {
      const { data } = await api.put(
        `/payments/payroll/${payrollId}/payment-method`,
        { payment_method: paymentMethod }
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payrolls'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update payment method'),
  });
}

// ── Advance payment hooks ──

export function useMpesaPayAdvance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (advanceId: number) => {
      const { data } = await api.post(`/payments/mpesa/pay-advance/${advanceId}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advances'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (err: Error) => toast.error(err.message || 'M-Pesa advance payment failed'),
  });
}

export function useMpesaBulkPayAdvances() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (advanceIds: number[]) => {
      const { data } = await api.post('/payments/mpesa/bulk-pay-advances', {
        advance_ids: advanceIds,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advances'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Bulk M-Pesa advance payment failed'),
  });
}

export function useMarkAdvanceCashPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (advanceId: number) => {
      const { data } = await api.post(`/payments/cash/pay-advance/${advanceId}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advances'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to mark advance cash paid'),
  });
}

export function useBulkMarkAdvanceCashPaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (advanceIds: number[]) => {
      const { data } = await api.post('/payments/cash/bulk-pay-advances', {
        advance_ids: advanceIds,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advances'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Bulk cash advance payment failed'),
  });
}

export function useUpdateAdvancePaymentMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      advanceId,
      paymentMethod,
    }: {
      advanceId: number;
      paymentMethod: string;
    }) => {
      const { data } = await api.put(
        `/payments/advance/${advanceId}/payment-method`,
        { payment_method: paymentMethod }
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['advances'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update payment method'),
  });
}

export function useResetStuckPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entity,
      entityId,
    }: {
      entity: 'payroll' | 'advance';
      entityId: number;
    }) => {
      const { data } = await api.post(
        `/payments/reset-stuck/${entity}/${entityId}`
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payrolls'] });
      qc.invalidateQueries({ queryKey: ['advances'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to reset payment'),
  });
}
