import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductStat } from '@/hooks/useAnalytics';
import { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';

interface Props {
  data: ProductStat[] | undefined;
  isLoading: boolean;
}

export default function ProductMixChart({ data, isLoading }: Props) {
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.slice(0, 8).map((p) => ({
      name: p.product_name,
      value: p.total_revenue,
    }));
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Garment Revenue Mix</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full rounded-lg" />
        ) : !chartData.length ? (
          <p className="text-sm text-muted-foreground text-center py-16">No data for this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={1}
                dataKey="value"
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill="var(--primary)" opacity={1 - i * 0.1} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `${Number(value).toLocaleString()} KES`}
                contentStyle={{
                  backgroundColor: 'var(--color-popover, #fff)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: '8px',
                  fontSize: '13px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
