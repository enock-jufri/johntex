import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

export interface WalletTransaction {
  id: number;
  worker_id: number;
  type: 'earning' | 'advance' | 'payout';
  amount: number;
  reference_type: string;
  reference_id: number;
  description: string | null;
  created_at: string;
}

export interface WorkerWallet {
  worker_id: number;
  total_earned: number;
  total_advanced: number;
  total_paid: number;
  balance: number;
  updated_at: string;
  transactions: WalletTransaction[];
}

export function useAllWallets() {
  return useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
      const { data } = await api.get<WorkerWallet[]>('/wallet/');
      return data;
    },
  });
}

export function useWorkerWallet(workerId: number) {
  return useQuery({
    queryKey: ['wallet', workerId],
    queryFn: async () => {
      const { data } = await api.get<WorkerWallet>(`/wallet/${workerId}`);
      return data;
    },
    enabled: !!workerId,
    staleTime: 0,
  });
}
