'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ProgressDataPoint } from '@/actions/progress';

interface VolumeChartProps {
  data: ProgressDataPoint[];
  yAxisFromZero?: boolean;
}

export function VolumeChart({ data, yAxisFromZero = true }: VolumeChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  // Determine Y-axis domain
  const yDomain: [number | 'auto', number | 'auto'] = yAxisFromZero
    ? [0, 'auto']
    : ['auto', 'auto'];

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Format volume for tooltip
  const formatVolume = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k kg`;
    }
    return `${value} kg`;
  };

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            className="text-xs"
          />
          <YAxis
            domain={yDomain}
            className="text-xs"
            tickFormatter={formatVolume}
            label={{ value: 'Volume (kg)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            formatter={(value) => [formatVolume(Number(value)), 'Total Volume']}
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
          <Bar
            dataKey="totalVolume"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
