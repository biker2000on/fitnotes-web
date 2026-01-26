'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ProgressDataPoint } from '@/actions/progress';

interface OneRMChartProps {
  data: ProgressDataPoint[];
  showTrendLine?: boolean;
  yAxisFromZero?: boolean;
}

export function OneRMChart({ data, showTrendLine = false, yAxisFromZero = false }: OneRMChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-muted-foreground">
        No data available
      </div>
    );
  }

  // Calculate trend line using linear regression
  const calculateTrendLine = () => {
    const n = data.length;
    const xValues = data.map((_, i) => i);
    const yValues = data.map(d => d.estimated1RM);

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * (yValues[i] ?? 0), 0);
    const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return data.map((d, i) => ({
      ...d,
      trend: slope * i + intercept,
    }));
  };

  const chartData = showTrendLine ? calculateTrendLine() : data;

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
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            className="text-xs"
          />
          <YAxis
            domain={yDomain}
            className="text-xs"
            label={{ value: 'Est. 1RM (kg)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(1)} kg`, 'Estimated 1RM']}
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{
              backgroundColor: 'hsl(var(--background))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
            }}
          />
          <Line
            type="monotone"
            dataKey="estimated1RM"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--primary))', r: 4 }}
            activeDot={{ r: 6 }}
          />
          {showTrendLine && (
            <Line
              type="monotone"
              dataKey="trend"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
