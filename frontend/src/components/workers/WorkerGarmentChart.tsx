import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ProductionLog } from '@/hooks/useProductionLogs';
import { Shirt } from 'lucide-react';
import { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

const garmentColors = ['#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

interface Props {
  logs: ProductionLog[] | undefined;
  products: { id: number; name: string }[] | undefined;
  isLoading: boolean;
}

export default function WorkerGarmentChart({ logs, products, isLoading }: Props) {
  const chartData = useMemo(() => {
    if (!logs || !products) return [];
    const productMap = new Map(products.map((p) => [p.id, p.name]));
    const totals = new Map<string, number>();
    logs.forEach((l) => {
      const name = productMap.get(l.product_id) || `#${l.product_id}`;
      totals.set(name, (totals.get(name) || 0) + l.quantity);
    });
    return Array.from(totals.entries())
      .map(([name, pieces]) => ({ name, pieces }))
      .sort((a, b) => b.pieces - a.pieces);
  }, [logs, products]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shirt className="h-4 w-4 text-purple-500" /> Garments Produced
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full rounded-lg" />
        ) : !chartData.length ? (
          <p className="text-sm text-muted-foreground text-center py-16">No production data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={90}
                paddingAngle={2}
                dataKey="pieces"
              >
                {chartData.map((_, i) => (
                  <Cell key={i} fill={garmentColors[i % garmentColors.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [`${Number(value).toLocaleString()} pcs`, 'Pieces']}
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
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
