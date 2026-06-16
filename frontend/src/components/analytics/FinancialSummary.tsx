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
      icon: <DollarSign className="h-5 w-5 text-muted-foreground" />,
    },
    {
      label: 'Tailor Payments',
      value: data ? `${data.total_payroll.toLocaleString()} KES` : '—',
      icon: <TrendingDown className="h-5 w-5 text-muted-foreground" />,
    },
    {
      label: 'Approved Advances',
      value: data ? `${data.advance_total_approved.toLocaleString()} KES` : '—',
      icon: <Wallet className="h-5 w-5 text-muted-foreground" />,
    },
    {
      label: 'Net (Revenue - Payments)',
      value: data ? `${netProfit.toLocaleString()} KES` : '—',
      icon: <TrendingUp className="h-5 w-5 text-muted-foreground" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map((c) => (
        <Card key={c.label} className="transition hover:shadow-md">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">{c.label}</span>
              {c.icon}
            </div>
            {isLoading ? (
              <Skeleton className="h-7 w-24 mx-auto" />
            ) : (
              <p className="text-lg font-bold text-foreground">{c.value}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
