import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';
import { format } from 'date-fns';

type MeasurementRecord = {
  id: number;
  value: number;
  date: Date;
};

type Measurement = {
  id: number;
  name: string;
  unitId: number;
  goalType: number | null;
  goalValue: number | null;
  goalDate: Date | null;
  isDefault: boolean;
  records: MeasurementRecord[];
};

const UNIT_NAMES = ['kg', 'lbs', 'cm', 'inches'];

export function MeasurementCard({ measurement }: { measurement: Measurement }) {
  const latestRecord = measurement.records[0];
  const previousRecord = measurement.records[1];
  const unitName = UNIT_NAMES[measurement.unitId] || '';

  // Calculate trend
  let trend: 'up' | 'down' | 'stable' | 'none' = 'none';
  let trendValue = 0;

  if (latestRecord && previousRecord) {
    const diff = latestRecord.value - previousRecord.value;
    if (Math.abs(diff) < 0.1) {
      trend = 'stable';
    } else if (diff > 0) {
      trend = 'up';
      trendValue = diff;
    } else {
      trend = 'down';
      trendValue = Math.abs(diff);
    }
  }

  // Calculate goal progress
  const goalProgress = measurement.goalValue && latestRecord
    ? ((latestRecord.value / measurement.goalValue) * 100).toFixed(0)
    : null;

  return (
    <Card className="hover:bg-accent transition-colors cursor-pointer">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span>{measurement.name}</span>
          {measurement.goalValue && (
            <Target className="h-4 w-4 text-muted-foreground" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Latest Value */}
          <div className="flex items-end justify-between">
            <div>
              <div className="text-2xl font-bold">
                {latestRecord ? latestRecord.value : '--'}
              </div>
              <div className="text-xs text-muted-foreground">{unitName}</div>
            </div>

            {/* Trend Indicator */}
            {trend !== 'none' && (
              <div className="flex items-center gap-1">
                {trend === 'up' && (
                  <>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-xs text-green-500">+{trendValue.toFixed(1)}</span>
                  </>
                )}
                {trend === 'down' && (
                  <>
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    <span className="text-xs text-red-500">-{trendValue.toFixed(1)}</span>
                  </>
                )}
                {trend === 'stable' && (
                  <>
                    <Minus className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">0</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Last Updated */}
          {latestRecord && (
            <div className="text-xs text-muted-foreground">
              Last: {format(new Date(latestRecord.date), 'MMM d, yyyy')}
            </div>
          )}

          {/* Goal Progress Bar */}
          {goalProgress && (
            <div className="space-y-1">
              <div className="w-full bg-secondary rounded-full h-1.5">
                <div
                  className="bg-primary rounded-full h-1.5 transition-all"
                  style={{ width: `${Math.min(parseFloat(goalProgress), 100)}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {goalProgress}% of goal
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
