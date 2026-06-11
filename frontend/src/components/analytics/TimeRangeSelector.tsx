import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TimeRange, timeRangeLabels } from '@/hooks/useAnalytics';

const timeRangeOptions: TimeRange[] = [
  'this_month',
  'last_month',
  'last_30_days',
  'last_90_days',
  'this_year',
  'all_time',
];

interface Props {
  value: TimeRange;
  onChange: (value: TimeRange) => void;
}

export default function TimeRangeSelector({ value, onChange }: Props) {
  return (
    <Select
      value={value}
      onValueChange={(val) => onChange(val as TimeRange)}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {timeRangeOptions.map((key) => (
          <SelectItem key={key} value={key}>
            {timeRangeLabels[key]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
