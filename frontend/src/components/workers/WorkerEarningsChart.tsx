import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { WorkerWallet } from '@/hooks/useWallet';
import { Wallet } from 'lucide-react';
import { useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

const COLORS = { earning: '#22c55e', advance: '#ef4444', payout: '#3b82f6' };

interface Props {
  wallet: WorkerWallet | undefined;
  isLoading: boolean;
}

export default function WorkerEarningsChart({ wallet, isLoading }: Props) {
  const chartData = useMemo(() => {
    if (!wallet) return [];
    const items = [
      { name: 'Earnings', value: wallet.total_earned, color: COLORS.earning },
      { name: 'Advances', value: wallet.total_advanced, color: COLORS.advance },
      { name: 'Paid Out', value: wallet.total_paid, color: COLORS.payout },
    ];
    return items.filter((d) => d.value > 0);
  }, [wallet]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4 text-amber-500" /> Earnings Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-72 w-full rounded-lg" />
        ) : !chartData.length ? (
          <p className="text-sm text-muted-foreground text-center py-16">No financial data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={95}
                paddingAngle={3}
                dataKey="value"
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
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
              <Legend
                formatter={(value: string) => <span className="text-sm text-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
        {wallet && (
          <p className="text-center text-sm font-bold mt-2">
            Balance: <span className={wallet.balance >= 0 ? 'text-amber-600' : 'text-red-600'}>
              {wallet.balance.toLocaleString()} KES
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
