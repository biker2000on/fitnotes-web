'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Target, Trophy, Calendar, TrendingUp, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import type { GoalProgress } from '@/actions/goals';

const GOAL_TYPE_NAMES: Record<number, string> = {
  0: 'Max Weight',
  1: 'Max Reps',
  2: 'Total Volume',
  3: 'Max 1RM',
  4: 'Total Distance',
  5: 'Total Duration',
  6: 'Workout Count',
};

const GOAL_TYPE_UNITS: Record<number, string> = {
  0: 'kg',
  1: 'reps',
  2: 'kg',
  3: 'kg',
  4: 'km',
  5: 'hours',
  6: 'workouts',
};

interface GoalCardProps {
  goal: GoalProgress;
  onEdit: (goal: GoalProgress) => void;
  onDelete: (id: number) => void;
}

export function GoalCard({ goal, onEdit, onDelete }: GoalCardProps) {
  const formatValue = (value: number, typeId: number) => {
    if (typeId === 5) {
      // Duration in hours
      return value.toFixed(1);
    }
    return Math.round(value).toString();
  };

  const formatDate = (date: Date | null) => {
    if (!date) return null;
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysRemainingText = () => {
    if (!goal.daysRemaining) return null;
    if (goal.daysRemaining < 0) return 'Overdue';
    if (goal.daysRemaining === 0) return 'Due today';
    if (goal.daysRemaining === 1) return '1 day left';
    return `${goal.daysRemaining} days left`;
  };

  const getDaysRemainingColor = () => {
    if (!goal.daysRemaining) return 'text-muted-foreground';
    if (goal.daysRemaining < 0) return 'text-destructive';
    if (goal.daysRemaining <= 7) return 'text-orange-500';
    return 'text-muted-foreground';
  };

  return (
    <Card className={goal.isCompleted ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20' : ''}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1 flex-1">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-medium">
              {goal.exerciseName || 'General Goal'}
            </CardTitle>
            {goal.isCompleted && (
              <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                <Trophy className="h-3 w-3 mr-1" />
                Completed
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{GOAL_TYPE_NAMES[goal.goalTypeId]}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(goal)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(goal.id)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {formatValue(goal.currentValue, goal.goalTypeId)}
            </span>
            <span className="text-sm text-muted-foreground">
              / {formatValue(goal.targetValue, goal.goalTypeId)} {GOAL_TYPE_UNITS[goal.goalTypeId]}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{goal.progressPercentage}%</span>
          </div>
        </div>

        <Progress value={goal.progressPercentage} className="h-2" />

        {goal.targetDate && (
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Target: {formatDate(goal.targetDate)}</span>
            {!goal.isCompleted && (
              <span className={`ml-auto ${getDaysRemainingColor()}`}>
                {getDaysRemainingText()}
              </span>
            )}
          </div>
        )}

        {goal.isCompleted && goal.completedAt && (
          <div className="text-sm text-green-600 dark:text-green-400">
            Completed on {formatDate(goal.completedAt)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
