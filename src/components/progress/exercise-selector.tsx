'use client';

import { useState, useEffect } from 'react';
import { searchExercises } from '@/actions/exercises';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Search } from 'lucide-react';

interface Exercise {
  id: number;
  name: string;
  category: {
    name: string;
    color: string;
  } | null;
}

interface ExerciseSelectorProps {
  onExerciseSelect: (exerciseId: number) => void;
  selectedExerciseId: number | null;
}

export function ExerciseSelector({ onExerciseSelect, selectedExerciseId }: ExerciseSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadExercises = async () => {
      if (searchQuery.trim().length === 0) {
        setExercises([]);
        return;
      }

      setLoading(true);
      try {
        const results = await searchExercises(searchQuery);
        setExercises(results);
      } catch (error) {
        console.error('Failed to search exercises:', error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(loadExercises, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="exercise-search">Search Exercise</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="exercise-search"
            type="text"
            placeholder="Search for an exercise..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {searchQuery.trim().length > 0 && (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">Searching...</div>
            ) : exercises.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">No exercises found</div>
            ) : (
              <div className="divide-y">
                {exercises.map((exercise) => (
                  <button
                    key={exercise.id}
                    onClick={() => {
                      onExerciseSelect(exercise.id);
                      setSearchQuery('');
                    }}
                    className={`w-full text-left p-4 hover:bg-muted/50 transition-colors ${
                      selectedExerciseId === exercise.id ? 'bg-muted' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {exercise.category && (
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: exercise.category.color }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{exercise.name}</div>
                        {exercise.category && (
                          <div className="text-sm text-muted-foreground">{exercise.category.name}</div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
