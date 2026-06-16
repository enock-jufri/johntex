import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkerStat } from '@/hooks/useAnalytics';
import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface Props {
  data: WorkerStat[] | undefined;
  isLoading: boolean;
}

export default function WorkerProductivityChart({ data, isLoading }: Props) {
  const chartData = useMemo(() => {
    if (!data) return [];
    return data
      .map((w) => ({
        name: w.worker_name,
        revenue: w.total_revenue,
      }))
      .slice(0, 10);
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Tailor Productivity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full rounded-lg" />
        ) : !chartData.length ? (
          <p className="text-sm text-muted-foreground text-center py-16">No data for this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(chartData.length * 36, 200)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 12 }}
                width={100}
                className="text-muted-foreground"
              />
              <Tooltip
                formatter={(value) => `${Number(value).toLocaleString()} KES`}
                contentStyle={{
                  backgroundColor: 'var(--color-popover, #fff)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              />
              <Bar dataKey="revenue" fill="var(--primary)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
