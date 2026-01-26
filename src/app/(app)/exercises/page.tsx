'use client';

import { useState, useTransition } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { ExerciseItem } from '@/components/workout/exercise-item';
import { ExerciseForm } from '@/components/forms/exercise-form';
import { Plus, Search } from 'lucide-react';
import { getCategories } from '@/actions/categories';
import { getExercises, createExercise, updateExercise, deleteExercise, toggleFavorite } from '@/actions/exercises';
import { useEffect } from 'react';

type Category = { id: number; name: string; color: string };
type Exercise = { id: number; name: string; isFavorite: boolean; categoryId: number; category: { name: string; color: string } | null; exerciseTypeId: number; notes: string | null };

export default function ExercisesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [categoriesData, exercisesData] = await Promise.all([
      getCategories(),
      getExercises()
    ]);
    setCategories(categoriesData);
    setExercises(exercisesData);
  };

  const handleCreateExercise = async (data: any) => {
    startTransition(async () => {
      await createExercise(data);
      await loadData();
      setIsAddDialogOpen(false);
    });
  };

  const handleUpdateExercise = async (data: any) => {
    if (!selectedExercise) return;
    startTransition(async () => {
      await updateExercise(selectedExercise.id, data);
      await loadData();
      setIsEditDialogOpen(false);
      setSelectedExercise(null);
    });
  };

  const handleDeleteExercise = async () => {
    if (!selectedExercise) return;
    startTransition(async () => {
      await deleteExercise(selectedExercise.id);
      await loadData();
      setIsDeleteDialogOpen(false);
      setSelectedExercise(null);
    });
  };

  const handleToggleFavorite = async (id: number) => {
    startTransition(async () => {
      await toggleFavorite(id);
      await loadData();
    });
  };

  const filteredExercises = exercises.filter(ex =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedExercises = categories.map(category => ({
    category,
    exercises: filteredExercises.filter(ex => ex.categoryId === category.id)
  })).filter(group => group.exercises.length > 0);

  const favoriteExercises = filteredExercises.filter(ex => ex.isFavorite);

  return (
    <div>
      <Header title="Exercises" />
      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search exercises..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Exercise
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          {favoriteExercises.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold mb-2 px-2">Favorites</h3>
              <div className="space-y-1">
                {favoriteExercises.map(exercise => (
                  <ExerciseItem
                    key={exercise.id}
                    exercise={exercise}
                    onEdit={(id) => {
                      setSelectedExercise(exercises.find(ex => ex.id === id) || null);
                      setIsEditDialogOpen(true);
                    }}
                    onDelete={(id) => {
                      setSelectedExercise(exercises.find(ex => ex.id === id) || null);
                      setIsDeleteDialogOpen(true);
                    }}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
              <Separator className="my-4" />
            </div>
          )}

          {groupedExercises.map(({ category, exercises }) => (
            <div key={category.id} className="mb-6">
              <h3 className="text-sm font-semibold mb-2 px-2 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />
                {category.name}
              </h3>
              <div className="space-y-1">
                {exercises.map(exercise => (
                  <ExerciseItem
                    key={exercise.id}
                    exercise={exercise}
                    onEdit={(id) => {
                      setSelectedExercise(exercises.find(ex => ex.id === id) || null);
                      setIsEditDialogOpen(true);
                    }}
                    onDelete={(id) => {
                      setSelectedExercise(exercises.find(ex => ex.id === id) || null);
                      setIsDeleteDialogOpen(true);
                    }}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            </div>
          ))}

          {filteredExercises.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {searchQuery ? 'No exercises found matching your search.' : 'No exercises yet. Add your first exercise!'}
              </p>
            </div>
          )}
        </ScrollArea>
      </div>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Exercise</DialogTitle>
          </DialogHeader>
          <ExerciseForm
            categories={categories}
            onSubmit={handleCreateExercise}
            onCancel={() => setIsAddDialogOpen(false)}
            isLoading={isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Exercise</DialogTitle>
          </DialogHeader>
          {selectedExercise && (
            <ExerciseForm
              categories={categories}
              defaultValues={{
                name: selectedExercise.name,
                categoryId: selectedExercise.categoryId,
                exerciseTypeId: selectedExercise.exerciseTypeId,
                notes: selectedExercise.notes || undefined,
                isFavorite: selectedExercise.isFavorite,
              }}
              onSubmit={handleUpdateExercise}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setSelectedExercise(null);
              }}
              isLoading={isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exercise</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedExercise?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteDialogOpen(false);
              setSelectedExercise(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteExercise} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
