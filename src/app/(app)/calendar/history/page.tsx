'use client';

import { useState, useEffect, useTransition } from 'react';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Header } from '@/components/layout/header';
import { HistoryItem } from '@/components/workout/history-item';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getWorkoutHistory, getWorkoutSummary } from '@/actions/trainingLogs';
import { History, Search, Loader2 } from 'lucide-react';

interface WorkoutSummary {
  date: string;
  exerciseCount: number;
  setCount: number;
  totalVolume: number;
  exercises: {
    id: number;
    name: string;
    category: { name: string; color: string } | null;
  }[];
}

export default function HistoryPage() {
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [filteredWorkouts, setFilteredWorkouts] = useState<WorkoutSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState('all');
  const [groupBy, setGroupBy] = useState<'none' | 'week' | 'month'>('none');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isPending, startTransition] = useTransition();

  const LIMIT = 20;

  // Load initial workouts
  useEffect(() => {
    loadWorkouts(0, true);
  }, []);

  const loadWorkouts = (newOffset: number, reset: boolean = false) => {
    startTransition(async () => {
      const history = await getWorkoutHistory(LIMIT, newOffset);

      // Get summaries for each date
      const summaries = await Promise.all(
        history.map(async (item) => await getWorkoutSummary(item.date))
      );

      if (reset) {
        setWorkouts(summaries);
        setFilteredWorkouts(summaries);
      } else {
        setWorkouts(prev => [...prev, ...summaries]);
        setFilteredWorkouts(prev => [...prev, ...summaries]);
      }

      setHasMore(history.length === LIMIT);
      setOffset(newOffset);
    });
  };

  // Filter workouts by search and date range
  useEffect(() => {
    let filtered = workouts;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(workout =>
        workout.exercises.some(exercise =>
          exercise.name.toLowerCase().includes(query)
        )
      );
    }

    // Date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      let cutoffDate: Date;

      switch (dateRange) {
        case 'week':
          cutoffDate = subMonths(now, 0);
          cutoffDate.setDate(cutoffDate.getDate() - 7);
          break;
        case 'month':
          cutoffDate = subMonths(now, 1);
          break;
        case '3months':
          cutoffDate = subMonths(now, 3);
          break;
        case '6months':
          cutoffDate = subMonths(now, 6);
          break;
        default:
          cutoffDate = new Date(0);
      }

      filtered = filtered.filter(workout =>
        new Date(workout.date) >= cutoffDate
      );
    }

    setFilteredWorkouts(filtered);
  }, [searchQuery, dateRange, workouts]);

  // Calculate workout stats
  const totalWorkouts = filteredWorkouts.length;
  const totalSets = filteredWorkouts.reduce((sum, w) => sum + w.setCount, 0);
  const totalVolume = filteredWorkouts.reduce((sum, w) => sum + w.totalVolume, 0) / 1000;

  // Group workouts if needed
  const groupedWorkouts = groupBy === 'none' ? null : groupWorkouts(filteredWorkouts, groupBy);

  const handleLoadMore = () => {
    loadWorkouts(offset + LIMIT, false);
  };

  return (
    <div>
      <Header title="Workout History" />

      <div className="p-4 space-y-4">
        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-card rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">{totalWorkouts}</div>
            <div className="text-xs text-muted-foreground">Workouts</div>
          </div>
          <div className="bg-card rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">{totalSets}</div>
            <div className="text-xs text-muted-foreground">Total Sets</div>
          </div>
          <div className="bg-card rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">{totalVolume.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">kg Lifted</div>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by exercise name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Date Range and Group By */}
          <div className="flex gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
                <SelectItem value="3months">Last 3 Months</SelectItem>
                <SelectItem value="6months">Last 6 Months</SelectItem>
              </SelectContent>
            </Select>

            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as typeof groupBy)}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Group by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Grouping</SelectItem>
                <SelectItem value="week">By Week</SelectItem>
                <SelectItem value="month">By Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Workout List */}
        {filteredWorkouts.length === 0 ? (
          <div className="text-center py-12">
            <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No workouts found</p>
            <p className="text-sm text-muted-foreground">
              {searchQuery || dateRange !== 'all'
                ? 'Try adjusting your filters'
                : 'Start logging your workouts to see them here'}
            </p>
          </div>
        ) : groupedWorkouts ? (
          // Grouped view
          <div className="space-y-6">
            {Object.entries(groupedWorkouts).map(([group, workouts]) => (
              <div key={group}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase">
                  {group}
                </h3>
                <div className="space-y-2">
                  {workouts.map((workout) => (
                    <HistoryItem key={workout.date} {...workout} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Flat list
          <div className="space-y-2">
            {filteredWorkouts.map((workout) => (
              <HistoryItem key={workout.date} {...workout} />
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && !searchQuery && dateRange === 'all' && (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleLoadMore}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// Helper function to group workouts by week or month
function groupWorkouts(workouts: WorkoutSummary[], groupBy: 'week' | 'month') {
  const groups: Record<string, WorkoutSummary[]> = {};

  for (const workout of workouts) {
    const date = new Date(workout.date);
    let groupKey: string;

    if (groupBy === 'week') {
      // Get week start (Monday)
      const weekStart = new Date(date);
      const day = weekStart.getDay();
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
      weekStart.setDate(diff);
      groupKey = `Week of ${format(weekStart, 'MMM d, yyyy')}`;
    } else {
      // Month
      groupKey = format(startOfMonth(date), 'MMMM yyyy');
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey]!.push(workout);
  }

  return groups;
}
