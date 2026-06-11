import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AnalyticsData } from '@/hooks/useAnalytics';
import { DollarSign, Scissors, Target, Award, Users } from 'lucide-react';

interface Props {
  data: AnalyticsData | undefined;
  isLoading: boolean;
}

const statCards = [
  { label: 'Total Revenue', key: 'total_revenue' as const, icon: <DollarSign className="h-5 w-5 text-blue-500" />, color: 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/30', format: (v: number) => `${v.toLocaleString()} KES` },
  { label: 'Total Garments', key: 'total_pieces' as const, icon: <Scissors className="h-5 w-5 text-green-500" />, color: 'border-l-green-500 bg-green-50/50 dark:bg-green-950/30', format: (v: number) => `${v.toLocaleString()}` },
  { label: 'Avg per Garment', key: null as null, icon: <Target className="h-5 w-5 text-purple-500" />, color: 'border-l-purple-500 bg-purple-50/50 dark:bg-purple-950/30', compute: (d: AnalyticsData) => d.total_pieces > 0 ? `${(d.total_revenue / d.total_pieces).toFixed(2)} KES` : '—' },
  { label: 'Approval Rate', key: null as null, icon: <Award className="h-5 w-5 text-amber-500" />, color: 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/30', compute: (d: AnalyticsData) => (d.approved_count + d.pending_count) > 0 ? `${Math.round((d.approved_count / (d.approved_count + d.pending_count)) * 100)}%` : '—' },
  { label: 'Active Tailors', key: 'worker_count' as const, icon: <Users className="h-5 w-5 text-rose-500" />, color: 'border-l-rose-500 bg-rose-50/50 dark:bg-rose-950/30', format: (v: number) => `${v}` },
];

export default function AnalyticsOverview({ data, isLoading }: Props) {
  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
      {statCards.map((s) => (
        <Card key={s.label} className={`border-l-4 ${s.color} transition hover:shadow-md`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              {s.icon}
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-bold tracking-tight">
                {data
                  ? s.compute
                    ? s.compute(data)
                    : s.format
                      ? s.format(data[s.key!] as number)
                      : ''
                  : '—'}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
