import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  action: string;
  details: string | null;
  ip_address: string | null;
  user_agent: string | null;
  location: string | null;
  event_time: string;
}

export function useAuditLogs(startDate?: string, endDate?: string, action?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set('start_date', startDate);
  if (endDate) params.set('end_date', endDate);
  if (action) params.set('action', action);
  const qs = params.toString();
  return useQuery({
    queryKey: ['auditLogs', startDate, endDate, action],
    queryFn: async () => {
      const { data } = await api.get<AuditLogEntry[]>(`/audit/${qs ? `?${qs}` : ''}`);
      return data;
    },
  });
}

export function useAuditActions() {
  return useQuery({
    queryKey: ['auditActions'],
    queryFn: async () => {
      const { data } = await api.get<string[]>('/audit/actions');
      return data;
    },
  });
}
