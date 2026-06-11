import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

export interface DailyPoint {
  date: string;
  revenue: number;
  pieces: number;
}

export interface WorkerStat {
  worker_id: number;
  worker_name: string;
  total_revenue: number;
  total_pieces: number;
}

export interface ProductStat {
  product_id: number;
  product_name: string;
  total_revenue: number;
  total_pieces: number;
  percentage: number;
}

export interface WeeklyPayrollStat {
  week_start: string;
  gross_pay: number;
  net_pay: number;
}

export interface AnalyticsData {
  total_revenue: number;
  total_pieces: number;
  total_payroll: number;
  total_advances: number;
  approved_count: number;
  pending_count: number;
  worker_count: number;
  daily_revenue: DailyPoint[];
  worker_stats: WorkerStat[];
  product_stats: ProductStat[];
  weekly_payroll: WeeklyPayrollStat[];
  advance_total_approved: number;
  advance_total_pending: number;
}

export type TimeRange = 'this_month' | 'last_month' | 'last_30_days' | 'last_90_days' | 'this_year' | 'all_time';

function getDateRange(range: TimeRange): { start_date: string; end_date: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const firstOfMonth = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}-01`;
  const lastOfMonth = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;

  switch (range) {
    case 'this_month':
      return {
        start_date: firstOfMonth(now.getFullYear(), now.getMonth() + 1),
        end_date: today,
      };
    case 'last_month': {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return {
        start_date: firstOfMonth(prev.getFullYear(), prev.getMonth() + 1),
        end_date: lastOfMonth(prev.getFullYear(), prev.getMonth() + 1),
      };
    }
    case 'last_30_days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { start_date: d.toISOString().slice(0, 10), end_date: today };
    }
    case 'last_90_days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      return { start_date: d.toISOString().slice(0, 10), end_date: today };
    }
    case 'this_year':
      return {
        start_date: `${now.getFullYear()}-01-01`,
        end_date: today,
      };
    case 'all_time':
      return { start_date: '2020-01-01', end_date: today };
  }
}

export const timeRangeLabels: Record<TimeRange, string> = {
  this_month: 'This Month',
  last_month: 'Last Month',
  last_30_days: 'Last 30 Days',
  last_90_days: 'Last 90 Days',
  this_year: 'This Year',
  all_time: 'All Time',
};

export function useAnalytics(timeRange: TimeRange) {
  const { start_date, end_date } = useMemo(() => getDateRange(timeRange), [timeRange]);

  return useQuery({
    queryKey: ['analytics', start_date, end_date],
    queryFn: async () => {
      const { data } = await api.get<AnalyticsData>(
        `/analytics/?start_date=${start_date}&end_date=${end_date}`
      );
      return data;
    },
    staleTime: 60_000,
  });
}
