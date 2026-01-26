'use client';

import { useState, useTransition } from 'react';
import { Plus, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CategoryBadge } from './category-badge';
import { searchExercises, getExercises } from '@/actions/exercises';

interface Exercise {
  id: number;
  name: string;
  category: { name: string; color: string } | null;
}

interface AddExerciseDialogProps {
  onAdd: (exerciseId: number) => void;
}

export function AddExerciseDialog({ onAdd }: AddExerciseDialogProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleSearch = (value: string) => {
    setQuery(value);
    if (value.length > 0) {
      startTransition(async () => {
        const results = await searchExercises(value);
        setExercises(results as Exercise[]);
      });
    } else {
      startTransition(async () => {
        const results = await getExercises();
        setExercises(results as Exercise[]);
      });
    }
  };

  const handleAdd = (exerciseId: number) => {
    onAdd(exerciseId);
    setOpen(false);
    setQuery('');
  };

  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    if (open && exercises.length === 0) {
      startTransition(async () => {
        const results = await getExercises();
        setExercises(results as Exercise[]);
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="fixed bottom-6 right-6 rounded-full h-14 w-14 shadow-lg">
          <Plus className="h-6 w-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Exercise</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search exercises..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {isPending ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : exercises.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No exercises found. Create one in the Exercises page.
            </div>
          ) : (
            exercises.map((exercise) => (
              <button
                key={exercise.id}
                onClick={() => handleAdd(exercise.id)}
                className="w-full p-3 rounded-lg border hover:bg-accent text-left transition-colors"
              >
                <div className="font-medium">{exercise.name}</div>
                {exercise.category && (
                  <div className="mt-1">
                    <CategoryBadge
                      name={exercise.category.name}
                      color={exercise.category.color}
                    />
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
