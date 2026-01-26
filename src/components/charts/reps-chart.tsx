'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ProgressDataPoint } from '@/actions/progress';

interface RepsChartProps {
  data: ProgressDataPoint[];
  yAxisFromZero?: boolean;
}

export function RepsChart({ data, yAxisFromZero = true }: RepsChartProps) {
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

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            className="text-xs"
          />
          <YAxis
            domain={yDomain}
            className="text-xs"
            label={{ value: 'Total Reps', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            formatter={(value) => [`${value} reps`, 'Total Reps']}
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
          <Line
            type="monotone"
            dataKey="totalReps"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--primary))', r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
