import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { Payroll } from '@/hooks/usePayroll';
import { Calendar } from 'lucide-react';
import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface Props {
  payrolls: Payroll[] | undefined;
  isLoading: boolean;
}

export default function WorkerPayrollChart({ payrolls, isLoading }: Props) {
  const chartData = useMemo(() => {
    if (!payrolls) return [];
    return [...payrolls]
      .sort((a, b) => new Date(a.week_start).getTime() - new Date(b.week_start).getTime())
      .map((p) => ({
        week: new Date(p.week_start).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        Gross: p.gross_pay,
        Advances: p.total_advances,
        Net: p.net_pay,
      }));
  }, [payrolls]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4 text-purple-500" /> Weekly Payroll History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full rounded-lg" />
        ) : !chartData.length ? (
          <p className="text-sm text-muted-foreground text-center py-16">No payroll history yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip
                formatter={(value) => `${Number(value).toLocaleString()} KES`}
                contentStyle={{
                  backgroundColor: 'var(--color-popover, #fff)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              />
              <Legend
                formatter={(value: string) => <span className="text-sm text-foreground">{value}</span>}
              />
              <Bar dataKey="Gross" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Advances" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Net" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
