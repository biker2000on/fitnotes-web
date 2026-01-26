'use client';

import { useState, useEffect, useTransition } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MetricsSummaryCards } from '@/components/charts/metrics-summary-cards';
import { BreakdownPieChart } from '@/components/charts/breakdown-pie-chart';
import { BreakdownTable } from '@/components/charts/breakdown-table';
import {
  getBreakdownByCategory,
  getBreakdownByExercise,
  getMetricsSummary,
  type CategoryBreakdown,
  type ExerciseBreakdown,
  type MetricsSummary,
} from '@/actions/analysis';
import { format, subDays, subWeeks, subMonths, subYears, startOfYear } from 'date-fns';

type TimePeriod = 'all' | 'year' | 'month' | 'week' | 'custom';

interface DateRange {
  startDate?: string;
  endDate?: string;
}

export default function AnalysisPage() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all');
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [metrics, setMetrics] = useState<MetricsSummary>({
    totalSets: 0,
    totalReps: 0,
    totalVolume: 0,
    workoutCount: 0,
    avgVolumePerWorkout: 0,
  });
  const [categoryData, setCategoryData] = useState<CategoryBreakdown[]>([]);
  const [exerciseData, setExerciseData] = useState<ExerciseBreakdown[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadData();
  }, [dateRange]);

  const loadData = async () => {
    startTransition(async () => {
      const [metricsData, categoryBreakdown, exerciseBreakdown] = await Promise.all([
        getMetricsSummary(dateRange.startDate, dateRange.endDate),
        getBreakdownByCategory(dateRange.startDate, dateRange.endDate),
        getBreakdownByExercise(dateRange.startDate, dateRange.endDate),
      ]);

      setMetrics(metricsData);
      setCategoryData(categoryBreakdown);
      setExerciseData(exerciseBreakdown);
    });
  };

  const handleTimePeriodChange = (period: TimePeriod) => {
    setTimePeriod(period);
    const today = format(new Date(), 'yyyy-MM-dd');

    switch (period) {
      case 'all':
        setDateRange({});
        break;
      case 'year':
        setDateRange({
          startDate: format(startOfYear(new Date()), 'yyyy-MM-dd'),
          endDate: today,
        });
        break;
      case 'month':
        setDateRange({
          startDate: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
          endDate: today,
        });
        break;
      case 'week':
        setDateRange({
          startDate: format(subWeeks(new Date(), 1), 'yyyy-MM-dd'),
          endDate: today,
        });
        break;
      case 'custom':
        // Handle custom date range in future
        break;
    }
  };

  // Transform data for pie chart
  const categoryPieData = categoryData.map(item => ({
    name: item.categoryName,
    value: item.volume,
    color: item.color,
    percentage: item.percentage,
  }));

  const exercisePieData = exerciseData.map(item => ({
    name: item.exerciseName,
    value: item.volume,
    color: item.categoryColor,
    percentage: item.percentage,
  }));

  // Transform data for table
  const categoryTableData = categoryData.map(item => ({
    name: item.categoryName,
    color: item.color,
    sets: item.sets,
    reps: item.reps,
    volume: item.volume,
    percentage: item.percentage,
  }));

  const exerciseTableData = exerciseData.map(item => ({
    name: item.exerciseName,
    color: item.categoryColor,
    sets: item.sets,
    reps: item.reps,
    volume: item.volume,
    percentage: item.percentage,
  }));

  const getPeriodLabel = () => {
    switch (timePeriod) {
      case 'all':
        return 'All Time';
      case 'year':
        return 'This Year';
      case 'month':
        return 'Last 30 Days';
      case 'week':
        return 'Last 7 Days';
      case 'custom':
        return 'Custom Range';
      default:
        return 'All Time';
    }
  };

  return (
    <div>
      <Header title="Analysis" />
      <div className="p-4 space-y-6">
        {/* Time Period Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Time Period</CardTitle>
            <CardDescription>Select the time period to analyze</CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={timePeriod} onValueChange={(value) => handleTimePeriodChange(value as TimePeriod)}>
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Select time period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Metrics Summary */}
        <MetricsSummaryCards
          totalSets={metrics.totalSets}
          totalReps={metrics.totalReps}
          totalVolume={metrics.totalVolume}
          workoutCount={metrics.workoutCount}
        />

        {/* Breakdown Tabs */}
        <Tabs defaultValue="category" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="category">By Category</TabsTrigger>
            <TabsTrigger value="exercise">By Exercise</TabsTrigger>
          </TabsList>

          <TabsContent value="category" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <BreakdownPieChart
                data={categoryPieData}
                title="Volume by Category"
                description={`Breakdown of total volume by exercise category - ${getPeriodLabel()}`}
              />
              <BreakdownTable
                data={categoryTableData}
                title="Category Details"
                description="Complete breakdown of sets, reps, and volume"
              />
            </div>
          </TabsContent>

          <TabsContent value="exercise" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <BreakdownPieChart
                data={exercisePieData}
                title="Volume by Exercise"
                description={`Breakdown of total volume by exercise - ${getPeriodLabel()}`}
              />
              <BreakdownTable
                data={exerciseTableData}
                title="Exercise Details"
                description="Complete breakdown of sets, reps, and volume"
              />
            </div>
          </TabsContent>
        </Tabs>

        {isPending && (
          <div className="text-center text-muted-foreground">
            Loading analysis data...
          </div>
        )}
      </div>
    </div>
  );
}
