import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  to?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  subtitle?: string;
}

export default function StatCard({ label, value, icon, to, trend, trendValue, subtitle }: StatCardProps) {
  const content = (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:ring-2 hover:ring-primary/10 hover:-translate-y-0.5 cursor-default">
      <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-primary/5 transition-transform group-hover:scale-150" />
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{label}</span>
          <span className="text-muted-foreground/50 transition-colors group-hover:text-primary">{icon}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</p>
          {trend && trendValue && (
            <span className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium',
              trend === 'up' && 'text-emerald-600 dark:text-emerald-400',
              trend === 'down' && 'text-red-600 dark:text-red-400',
              trend === 'neutral' && 'text-muted-foreground',
            )}>
              {trend === 'up' && <ArrowUp className="h-3 w-3" />}
              {trend === 'down' && <ArrowDown className="h-3 w-3" />}
              {trend === 'neutral' && <Minus className="h-3 w-3" />}
              {trendValue}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );

  if (to) return <Link to={to} className="block">{content}</Link>;
  return content;
}
