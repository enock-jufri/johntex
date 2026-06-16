import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DailyPoint } from '@/hooks/useAnalytics';
import { TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface Props {
  data: DailyPoint[] | undefined;
  isLoading: boolean;
}

export default function RevenueTrendChart({ data, isLoading }: Props) {
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.map((d) => ({
      date: new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      revenue: d.revenue,
      pieces: d.pieces,
    }));
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <TrendingUp className="h-4 w-4 text-muted-foreground" /> Revenue &amp; Garment Production
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full rounded-lg" />
        ) : !chartData.length ? (
          <p className="text-sm text-muted-foreground text-center py-16">No data for this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-popover, #fff)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name="Revenue (KES)"
                stroke="var(--primary)"
                fill="url(#revenueFill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
