'use client';

import { format } from 'date-fns';
import { ExerciseStats } from '@/actions/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { gramsToKg } from '@/lib/calculations';
import { Trophy, TrendingUp, Calendar, Dumbbell, Target, Activity } from 'lucide-react';

interface ExerciseStatsCardProps {
  stats: ExerciseStats;
}

export function ExerciseStatsCard({ stats }: ExerciseStatsCardProps) {
  const StatItem = ({
    icon: Icon,
    label,
    value,
    subtitle,
  }: {
    icon: React.ElementType;
    label: string;
    value: string | number;
    subtitle?: string;
  }) => (
    <div className="flex flex-col gap-2 p-4 rounded-lg bg-muted/50">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-sm">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>All-Time Statistics</CardTitle>
      </CardHeader>
      <CardContent>
        {stats.totalSets === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No workout data yet. Start logging your sets!
          </div>
        ) : (
          <div className="space-y-6">
            {/* Workout Overview */}
            <div>
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">Workout Overview</h3>
              <div className="grid grid-cols-2 gap-3">
                <StatItem
                  icon={Activity}
                  label="Total Sets"
                  value={stats.totalSets}
                />
                <StatItem
                  icon={TrendingUp}
                  label="Total Reps"
                  value={stats.totalReps}
                />
                <StatItem
                  icon={Dumbbell}
                  label="Total Volume"
                  value={`${gramsToKg(stats.totalVolume).toFixed(0)} kg`}
                />
                <StatItem
                  icon={Calendar}
                  label="Workouts"
                  value={stats.totalWorkouts}
                />
              </div>
            </div>

            {/* Workout Dates */}
            <div>
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">Timeline</h3>
              <div className="grid grid-cols-2 gap-3">
                <StatItem
                  icon={Calendar}
                  label="First Workout"
                  value={stats.firstWorkoutDate ? format(new Date(stats.firstWorkoutDate), 'MMM d, yyyy') : 'N/A'}
                />
                <StatItem
                  icon={Calendar}
                  label="Last Workout"
                  value={stats.lastWorkoutDate ? format(new Date(stats.lastWorkoutDate), 'MMM d, yyyy') : 'N/A'}
                />
              </div>
            </div>

            {/* Best Lifts */}
            <div>
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">Best Lifts</h3>
              <div className="grid grid-cols-2 gap-3">
                <StatItem
                  icon={Trophy}
                  label="Max Weight"
                  value={`${gramsToKg(stats.maxWeight).toFixed(1)} kg`}
                />
                <StatItem
                  icon={TrendingUp}
                  label="Max Reps"
                  value={stats.maxReps}
                />
                <StatItem
                  icon={Target}
                  label="Best 1RM"
                  value={`${gramsToKg(stats.max1RM).toFixed(1)} kg`}
                />
                <StatItem
                  icon={Dumbbell}
                  label="Max Volume"
                  value={`${gramsToKg(stats.maxVolume).toFixed(0)} kg`}
                  subtitle="single set"
                />
              </div>
            </div>

            {/* Averages */}
            <div>
              <h3 className="text-sm font-medium mb-3 text-muted-foreground">Averages</h3>
              <div className="grid grid-cols-2 gap-3">
                <StatItem
                  icon={Dumbbell}
                  label="Avg Weight"
                  value={`${gramsToKg(stats.averageWeight).toFixed(1)} kg`}
                />
                <StatItem
                  icon={TrendingUp}
                  label="Avg Reps"
                  value={stats.averageReps}
                />
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
