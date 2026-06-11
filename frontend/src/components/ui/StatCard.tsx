import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  to?: string;
}

export default function StatCard({ label, value, icon, to }: StatCardProps) {
  const content = (
    <Card className="transition hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-muted-foreground text-sm">{label}</span>
          <span className="text-primary">{icon}</span>
        </div>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );

  if (to) return <Link to={to}>{content}</Link>;
  return content;
}
