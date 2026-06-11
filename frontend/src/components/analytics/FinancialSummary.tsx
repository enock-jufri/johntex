import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AnalyticsData } from '@/hooks/useAnalytics';
import { DollarSign, TrendingDown, Wallet, TrendingUp } from 'lucide-react';

interface Props {
  data: AnalyticsData | undefined;
  isLoading: boolean;
}

export default function FinancialSummary({ data, isLoading }: Props) {
  const netProfit = data ? data.total_revenue - data.total_payroll : 0;

  const cards = [
    {
      label: 'Gross Revenue',
      value: data ? `${data.total_revenue.toLocaleString()} KES` : '—',
      icon: <DollarSign className="h-5 w-5 text-blue-500" />,
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      text: 'text-blue-700 dark:text-blue-300',
    },
    {
      label: 'Tailor Payments',
      value: data ? `${data.total_payroll.toLocaleString()} KES` : '—',
      icon: <TrendingDown className="h-5 w-5 text-rose-500" />,
      bg: 'bg-rose-50 dark:bg-rose-950/30',
      text: 'text-rose-700 dark:text-rose-300',
    },
    {
      label: 'Approved Advances',
      value: data ? `${data.advance_total_approved.toLocaleString()} KES` : '—',
      icon: <Wallet className="h-5 w-5 text-amber-500" />,
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      text: 'text-amber-700 dark:text-amber-300',
    },
    {
      label: 'Net (Revenue - Payments)',
      value: data ? `${netProfit.toLocaleString()} KES` : '—',
      icon: <TrendingUp className="h-5 w-5 text-green-500" />,
      bg: 'bg-green-50 dark:bg-green-950/30',
      text: netProfit >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map((c) => (
        <Card key={c.label} className={`${c.bg} transition hover:shadow-md`}>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">{c.label}</span>
              {c.icon}
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-24 mx-auto" />
            ) : (
              <p className={`text-lg font-bold ${c.text}`}>{c.value}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
