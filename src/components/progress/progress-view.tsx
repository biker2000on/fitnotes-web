'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PRTimeline } from '@/components/charts/pr-timeline';
import { ExerciseStatsCard } from '@/components/charts/exercise-stats-card';
import { WeightProgressChart } from '@/components/charts/weight-progress-chart';
import { VolumeChart } from '@/components/charts/volume-chart';
import { OneRMChart } from '@/components/charts/one-rm-chart';
import { RepsChart } from '@/components/charts/reps-chart';
import { getExercisePRs, getExerciseStats, getExerciseProgressData, type PRRecord, type ExerciseStats, type ProgressDataPoint } from '@/actions/progress';
import { Loader2, TrendingUp, BarChart3, LineChart, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface ProgressViewProps {
  exerciseId: number | null;
}

type TimePeriod = '7d' | '30d' | '90d' | '1y' | 'all';

export function ProgressView({ exerciseId }: ProgressViewProps) {
  const [prs, setPRs] = useState<PRRecord[]>([]);
  const [stats, setStats] = useState<ExerciseStats | null>(null);
  const [progressData, setProgressData] = useState<ProgressDataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [chartLoading, setChartLoading] = useState(false);
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d');
  const [showTrendLine, setShowTrendLine] = useState(false);
  const [yAxisFromZero, setYAxisFromZero] = useState(false);
  const [chartType, setChartType] = useState<'weight' | 'volume' | '1rm' | 'reps'>('weight');

  useEffect(() => {
    if (!exerciseId) {
      setPRs([]);
      setStats(null);
      setProgressData([]);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const [prsData, statsData] = await Promise.all([
          getExercisePRs(exerciseId),
          getExerciseStats(exerciseId),
        ]);
        setPRs(prsData);
        setStats(statsData);
      } catch (error) {
        console.error('Failed to load progress data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [exerciseId]);

  // Load chart data when exercise or time period changes
  useEffect(() => {
    if (!exerciseId) {
      setProgressData([]);
      return;
    }

    const loadChartData = async () => {
      setChartLoading(true);
      try {
        const { startDate, endDate } = getDateRange(timePeriod);
        const data = await getExerciseProgressData(exerciseId, startDate, endDate);
        setProgressData(data);
      } catch (error) {
        console.error('Failed to load chart data:', error);
      } finally {
        setChartLoading(false);
      }
    };

    loadChartData();
  }, [exerciseId, timePeriod]);

  function getDateRange(period: TimePeriod): { startDate?: string; endDate?: string } {
    const today = new Date();
    const startDate = new Date();

    switch (period) {
      case '7d':
        startDate.setDate(today.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(today.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(today.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(today.getFullYear() - 1);
        break;
      case 'all':
        return {};
    }

    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
    };
  }

  if (!exerciseId) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Select an exercise to view progress</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="prs" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="prs">PRs</TabsTrigger>
        <TabsTrigger value="charts">Charts</TabsTrigger>
        <TabsTrigger value="stats">Stats</TabsTrigger>
      </TabsList>

      <TabsContent value="prs" className="space-y-4">
        <PRTimeline prs={prs} />
      </TabsContent>

      <TabsContent value="charts" className="space-y-4">
        {/* Time Period Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Time Period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={timePeriod === '7d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimePeriod('7d')}
              >
                7 Days
              </Button>
              <Button
                variant={timePeriod === '30d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimePeriod('30d')}
              >
                30 Days
              </Button>
              <Button
                variant={timePeriod === '90d' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimePeriod('90d')}
              >
                90 Days
              </Button>
              <Button
                variant={timePeriod === '1y' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimePeriod('1y')}
              >
                1 Year
              </Button>
              <Button
                variant={timePeriod === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimePeriod('all')}
              >
                All Time
              </Button>
            </div>

            {/* Chart Type Selector */}
            <div className="space-y-2">
              <Label>Chart Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={chartType === 'weight' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('weight')}
                  className="justify-start"
                >
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Weight
                </Button>
                <Button
                  variant={chartType === 'volume' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('volume')}
                  className="justify-start"
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Volume
                </Button>
                <Button
                  variant={chartType === '1rm' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('1rm')}
                  className="justify-start"
                >
                  <LineChart className="mr-2 h-4 w-4" />
                  1RM
                </Button>
                <Button
                  variant={chartType === 'reps' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setChartType('reps')}
                  className="justify-start"
                >
                  <Activity className="mr-2 h-4 w-4" />
                  Reps
                </Button>
              </div>
            </div>

            {/* Chart Controls */}
            <div className="space-y-3 pt-2 border-t">
              {(chartType === 'weight' || chartType === '1rm') && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="trend-line" className="text-sm">
                    Show Trend Line
                  </Label>
                  <Switch
                    id="trend-line"
                    checked={showTrendLine}
                    onCheckedChange={setShowTrendLine}
                  />
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label htmlFor="y-axis-zero" className="text-sm">
                  Y-Axis from Zero
                </Label>
                <Switch
                  id="y-axis-zero"
                  checked={yAxisFromZero}
                  onCheckedChange={setYAxisFromZero}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart Display */}
        {chartLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {chartType === 'weight' && 'Max Weight Progress'}
                {chartType === 'volume' && 'Total Volume Progress'}
                {chartType === '1rm' && 'Estimated 1RM Progress'}
                {chartType === 'reps' && 'Total Reps Progress'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartType === 'weight' && (
                <WeightProgressChart
                  data={progressData}
                  showTrendLine={showTrendLine}
                  yAxisFromZero={yAxisFromZero}
                />
              )}
              {chartType === 'volume' && (
                <VolumeChart
                  data={progressData}
                  yAxisFromZero={yAxisFromZero}
                />
              )}
              {chartType === '1rm' && (
                <OneRMChart
                  data={progressData}
                  showTrendLine={showTrendLine}
                  yAxisFromZero={yAxisFromZero}
                />
              )}
              {chartType === 'reps' && (
                <RepsChart
                  data={progressData}
                  yAxisFromZero={yAxisFromZero}
                />
              )}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="stats" className="space-y-4">
        {stats && <ExerciseStatsCard stats={stats} />}
      </TabsContent>
    </Tabs>
  );
}
