'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, TrendingUp, Dumbbell, Calendar } from 'lucide-react';

interface MetricsSummaryCardsProps {
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  workoutCount: number;
}

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description?: string;
}

function MetricCard({ title, value, icon, description }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function MetricsSummaryCards({
  totalSets,
  totalReps,
  totalVolume,
  workoutCount,
}: MetricsSummaryCardsProps) {
  const avgVolumePerWorkout = workoutCount > 0
    ? Math.round(totalVolume / workoutCount)
    : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Total Sets"
        value={totalSets.toLocaleString()}
        icon={<Dumbbell className="h-4 w-4 text-muted-foreground" />}
        description="All time"
      />
      <MetricCard
        title="Total Reps"
        value={totalReps.toLocaleString()}
        icon={<Activity className="h-4 w-4 text-muted-foreground" />}
        description="All time"
      />
      <MetricCard
        title="Total Volume"
        value={`${totalVolume.toLocaleString()} kg`}
        icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
        description="Weight × Reps"
      />
      <MetricCard
        title="Workouts"
        value={workoutCount.toLocaleString()}
        icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
        description={workoutCount > 0 ? `Avg: ${avgVolumePerWorkout.toLocaleString()} kg/workout` : 'No workouts yet'}
      />
    </div>
  );
}
