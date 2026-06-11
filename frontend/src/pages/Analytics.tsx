import { useState } from 'react';
import { useAnalytics, TimeRange, timeRangeLabels } from '../hooks/useAnalytics';
import TimeRangeSelector from '../components/analytics/TimeRangeSelector';
import AnalyticsOverview from '../components/analytics/AnalyticsOverview';
import RevenueTrendChart from '../components/analytics/RevenueTrendChart';
import WorkerProductivityChart from '../components/analytics/WorkerProductivityChart';
import ProductMixChart from '../components/analytics/ProductMixChart';
import ProductionVolumeChart from '../components/analytics/ProductionVolumeChart';
import FinancialSummary from '../components/analytics/FinancialSummary';

export default function Analytics() {
  const [timeRange, setTimeRange] = useState<TimeRange>('this_month');
  const { data, isLoading } = useAnalytics(timeRange);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground text-sm">
            {timeRangeLabels[timeRange]} — {new Date(data?.daily_revenue?.[0]?.date ?? '').toLocaleDateString('en', { year: 'numeric' })}
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      <AnalyticsOverview data={data} isLoading={isLoading} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueTrendChart data={data?.daily_revenue} isLoading={isLoading} />
        <ProductMixChart data={data?.product_stats} isLoading={isLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <WorkerProductivityChart data={data?.worker_stats} isLoading={isLoading} />
        <ProductionVolumeChart data={data?.daily_revenue} isLoading={isLoading} />
      </div>

      <FinancialSummary data={data} isLoading={isLoading} />
    </div>
  );
}
