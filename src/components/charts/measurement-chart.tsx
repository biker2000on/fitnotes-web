'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { format } from 'date-fns';

type MeasurementRecord = {
  id: number;
  value: number;
  date: Date;
};

interface MeasurementChartProps {
  records: MeasurementRecord[];
  unitName: string;
  goalValue?: number;
}

export function MeasurementChart({ records, unitName, goalValue }: MeasurementChartProps) {
  // Sort records by date (oldest first for chart)
  const sortedRecords = [...records].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Prepare data for chart
  const data = sortedRecords.map((record) => ({
    date: format(new Date(record.date), 'MMM d'),
    fullDate: format(new Date(record.date), 'MMM d, yyyy'),
    value: record.value,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          className="text-xs"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
        />
        <YAxis
          className="text-xs"
          tick={{ fill: 'hsl(var(--muted-foreground))' }}
          domain={['auto', 'auto']}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.5rem',
          }}
          labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
          formatter={(value: number | undefined) => value !== undefined ? [`${value} ${unitName}`, 'Value'] : ['-', 'Value']}
          labelFormatter={(label, payload) => {
            if (payload && payload.length > 0 && payload[0]) {
              return payload[0].payload.fullDate;
            }
            return label;
          }}
        />
        {goalValue && (
          <ReferenceLine
            y={goalValue}
            stroke="hsl(var(--primary))"
            strokeDasharray="5 5"
            label={{ value: `Goal: ${goalValue}`, position: 'right', fill: 'hsl(var(--primary))' }}
          />
        )}
        <Line
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ fill: 'hsl(var(--primary))', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
