import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../api/client';

export interface Worker {
  id: number;
  name: string;
  phone: string;
  active: boolean;
}

export function useWorkers() {
  return useQuery({
    queryKey: ['workers'],
    queryFn: async () => {
      const { data } = await api.get<Worker[]>('/workers/');
      return data;
    },
  });
}

export function useCreateWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (worker: { name: string; phone: string }) => {
      const { data } = await api.post('/workers/', worker);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workers'] }),
    onError: (err: Error) => toast.error(err.message || 'Failed to create worker'),
  });
}

export function useUpdateWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number; name?: string; phone?: string; active?: boolean }) => {
      const { data } = await api.put(`/workers/${id}`, updates);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workers'] }),
    onError: (err: Error) => toast.error(err.message || 'Failed to update worker'),
  });
}

export function useDeleteWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.delete(`/workers/${id}`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workers'] }),
    onError: (err: Error) => toast.error(err.message || 'Failed to delete worker'),
  });
}
