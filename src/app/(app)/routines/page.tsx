'use client';

import { useState, useEffect, useTransition } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { RoutineCard } from '@/components/routines/routine-card';
import { Plus } from 'lucide-react';
import { getRoutines, deleteRoutine, duplicateRoutine } from '@/actions/routines';
import type { Routine } from '@/types/routine';
import { useRouter } from 'next/navigation';

export default function RoutinesPage() {
  const router = useRouter();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadRoutines();
  }, []);

  const loadRoutines = async () => {
    const data = await getRoutines();
    setRoutines(data);
  };

  const handleEdit = (id: number) => {
    router.push(`/routines/${id}`);
  };

  const handleDelete = async () => {
    if (!selectedRoutine) return;
    startTransition(async () => {
      await deleteRoutine(selectedRoutine.id);
      await loadRoutines();
      setIsDeleteDialogOpen(false);
      setSelectedRoutine(null);
    });
  };

  const handleDuplicate = async (id: number) => {
    startTransition(async () => {
      await duplicateRoutine(id);
      await loadRoutines();
    });
  };

  return (
    <div>
      <Header title="Routines" />
      <div className="p-4 space-y-4">
        <Button onClick={() => router.push('/routines/new')} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          New Routine
        </Button>

        <ScrollArea className="h-[calc(100vh-200px)]">
          {routines.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No routines yet. Create your first routine!
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {routines.map((routine) => (
                <RoutineCard
                  key={routine.id}
                  routine={routine}
                  onEdit={handleEdit}
                  onDelete={(id) => {
                    setSelectedRoutine(routines.find(r => r.id === id) || null);
                    setIsDeleteDialogOpen(true);
                  }}
                  onDuplicate={handleDuplicate}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Routine</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedRoutine?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setIsDeleteDialogOpen(false);
              setSelectedRoutine(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
