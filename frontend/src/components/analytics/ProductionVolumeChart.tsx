import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DailyPoint } from '@/hooks/useAnalytics';
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
  data: DailyPoint[] | undefined;
  isLoading: boolean;
}

export default function ProductionVolumeChart({ data, isLoading }: Props) {
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.slice(-21).map((d) => ({
      date: new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      pieces: d.pieces,
    }));
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Daily Garment Production</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full rounded-lg" />
        ) : !chartData.length ? (
          <p className="text-sm text-muted-foreground text-center py-16">No data for this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-popover, #fff)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              />
              <Bar dataKey="pieces" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
