'use client';

import { useState, useEffect, useTransition, use } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { SectionCard } from '@/components/routines/section-card';
import { Plus, Save } from 'lucide-react';
import { getRoutine, updateRoutine, addSection, deleteSection, addExerciseToSection, removeExerciseFromSection, reorderSections, reorderExercises } from '@/actions/routines';
import { getExercises } from '@/actions/exercises';
import type { Routine } from '@/types/routine';
import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

type Exercise = { id: number; name: string; category: { name: string; color: string } | null };

export default function RoutineEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [routine, setRoutine] = useState<Routine | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [isAddSectionDialogOpen, setIsAddSectionDialogOpen] = useState(false);
  const [isAddExerciseDialogOpen, setIsAddExerciseDialogOpen] = useState(false);
  const [isDeleteSectionDialogOpen, setIsDeleteSectionDialogOpen] = useState(false);
  const [isRemoveExerciseDialogOpen, setIsRemoveExerciseDialogOpen] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [selectedSectionIdForDelete, setSelectedSectionIdForDelete] = useState<number | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<number | null>(null);
  const [selectedRoutineExerciseId, setSelectedRoutineExerciseId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadData();
  }, [resolvedParams.id]);

  const loadData = async () => {
    const [routineData, exercisesData] = await Promise.all([
      getRoutine(parseInt(resolvedParams.id)),
      getExercises(),
    ]);
    if (routineData) {
      setRoutine(routineData);
      setName(routineData.name);
      setNotes(routineData.notes || '');
    }
    setExercises(exercisesData);
  };

  const handleSave = async () => {
    if (!routine || !name.trim()) return;
    startTransition(async () => {
      await updateRoutine(routine.id, {
        name: name.trim(),
        notes: notes.trim() || undefined,
      });
      await loadData();
    });
  };

  const handleAddSection = async () => {
    if (!routine || !newSectionName.trim()) return;
    startTransition(async () => {
      await addSection(routine.id, newSectionName.trim());
      await loadData();
      setIsAddSectionDialogOpen(false);
      setNewSectionName('');
    });
  };

  const handleDeleteSection = async () => {
    if (!selectedSectionIdForDelete) return;
    startTransition(async () => {
      await deleteSection(selectedSectionIdForDelete);
      await loadData();
      setIsDeleteSectionDialogOpen(false);
      setSelectedSectionIdForDelete(null);
    });
  };

  const handleAddExercise = async () => {
    if (!selectedSectionId || !selectedExerciseId) return;
    startTransition(async () => {
      await addExerciseToSection(selectedSectionId, selectedExerciseId);
      await loadData();
      setIsAddExerciseDialogOpen(false);
      setSelectedSectionId(null);
      setSelectedExerciseId(null);
    });
  };

  const handleRemoveExercise = async () => {
    if (!selectedRoutineExerciseId) return;
    startTransition(async () => {
      await removeExerciseFromSection(selectedRoutineExerciseId);
      await loadData();
      setIsRemoveExerciseDialogOpen(false);
      setSelectedRoutineExerciseId(null);
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !routine || active.id === over.id) return;

    const oldIndex = routine.sections.findIndex((s) => s.id === active.id);
    const newIndex = routine.sections.findIndex((s) => s.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistically update local state
    const newSections = arrayMove(routine.sections, oldIndex, newIndex);
    setRoutine({ ...routine, sections: newSections });

    // Persist to database
    startTransition(async () => {
      await reorderSections(routine.id, newSections.map((s) => s.id));
    });
  };

  const handleReorderExercises = async (sectionId: number, exerciseIds: number[]) => {
    startTransition(async () => {
      await reorderExercises(sectionId, exerciseIds);
    });
  };

  if (!routine) {
    return (
      <div>
        <Header title="Loading..." />
        <div className="p-4 text-center">
          <p className="text-muted-foreground">Loading routine...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Edit Routine" />
      <div className="p-4 space-y-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="routine-name">Routine Name</Label>
            <Input
              id="routine-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter routine name..."
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="routine-notes">Notes</Label>
            <Textarea
              id="routine-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about this routine..."
              rows={3}
            />
          </div>
          <Button onClick={handleSave} disabled={!name.trim() || isPending} className="w-full">
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Sections</h3>
          <Button onClick={() => setIsAddSectionDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Section
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-400px)]">
          {routine.sections.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No sections yet. Add your first section!
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={routine.sections.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {routine.sections.map((section) => (
                    <SectionCard
                      key={section.id}
                      section={section}
                      onDelete={(id) => {
                        setSelectedSectionIdForDelete(id);
                        setIsDeleteSectionDialogOpen(true);
                      }}
                      onAddExercise={(id) => {
                        setSelectedSectionId(id);
                        setIsAddExerciseDialogOpen(true);
                      }}
                      onRemoveExercise={(id) => {
                        setSelectedRoutineExerciseId(id);
                        setIsRemoveExerciseDialogOpen(true);
                      }}
                      onEditExercise={() => {
                        // Reload data to update set counts after editing predefined sets
                        loadData();
                      }}
                      onReorderExercises={handleReorderExercises}
                      onSupersetChange={() => {
                        // Reload data to update superset groupings
                        loadData();
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </ScrollArea>
      </div>

      {/* Add Section Dialog */}
      <Dialog open={isAddSectionDialogOpen} onOpenChange={setIsAddSectionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Section</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="section-name">Section Name</Label>
              <Input
                id="section-name"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="e.g., Warm-up, Main Lifts, Accessories"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddSectionDialogOpen(false);
                setNewSectionName('');
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleAddSection} disabled={!newSectionName.trim() || isPending}>
              Add Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Exercise Dialog */}
      <Dialog open={isAddExerciseDialogOpen} onOpenChange={setIsAddExerciseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Exercise</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="exercise-select">Select Exercise</Label>
              <Select
                value={selectedExerciseId?.toString()}
                onValueChange={(value) => setSelectedExerciseId(parseInt(value))}
              >
                <SelectTrigger id="exercise-select">
                  <SelectValue placeholder="Choose an exercise..." />
                </SelectTrigger>
                <SelectContent>
                  {exercises.map((exercise) => (
                    <SelectItem key={exercise.id} value={exercise.id.toString()}>
                      {exercise.name}
                      {exercise.category && ` (${exercise.category.name})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddExerciseDialogOpen(false);
                setSelectedSectionId(null);
                setSelectedExerciseId(null);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleAddExercise} disabled={!selectedExerciseId || isPending}>
              Add Exercise
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Section Dialog */}
      <AlertDialog open={isDeleteSectionDialogOpen} onOpenChange={setIsDeleteSectionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this section? All exercises in this section will be removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteSectionDialogOpen(false);
              setSelectedSectionIdForDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSection}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Remove Exercise Dialog */}
      <AlertDialog open={isRemoveExerciseDialogOpen} onOpenChange={setIsRemoveExerciseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Exercise</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this exercise from the section?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsRemoveExerciseDialogOpen(false);
              setSelectedRoutineExerciseId(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveExercise}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isPending}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
