'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { ExerciseSelector } from '@/components/progress/exercise-selector';
import { ProgressView } from '@/components/progress/progress-view';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

export default function ProgressPage() {
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);

  return (
    <div>
      <Header title="Progress" />
      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Track Your Progress
            </CardTitle>
            <CardDescription>
              View personal records, statistics, and progress charts for your exercises
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ExerciseSelector
              onExerciseSelect={setSelectedExerciseId}
              selectedExerciseId={selectedExerciseId}
            />
          </CardContent>
        </Card>

        {selectedExerciseId && (
          <ProgressView exerciseId={selectedExerciseId} />
        )}
      </div>
    </div>
  );
}
