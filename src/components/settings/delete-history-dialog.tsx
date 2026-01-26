'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { CalendarIcon, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deleteHistory } from '@/actions/backup';
import { toast } from 'sonner';

interface DeleteHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteHistoryDialog({ open, onOpenChange }: DeleteHistoryDialogProps) {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [exercisesList, setExercisesList] = useState<any[]>([]);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      // Load exercises and categories for filters
      // This is a placeholder - in real app, fetch via server action
      setExercisesList([]);
      setCategoriesList([]);
    }
  }, [open]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteHistory({
        startDate: startDate?.toISOString().split('T')[0],
        endDate: endDate?.toISOString().split('T')[0],
        exerciseId: selectedExercise ? parseInt(selectedExercise) : undefined,
        categoryId: selectedCategory ? parseInt(selectedCategory) : undefined,
      });

      if (result.success) {
        toast.success('History deleted', {
          description: `Successfully deleted ${result.count} training log(s)`,
        });
        onOpenChange(false);
      } else {
        toast.error('Delete failed', {
          description: result.error || 'Failed to delete history',
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setIsDeleting(false);
      setShowConfirmation(false);
    }
  };

  const getDeleteSummary = () => {
    const parts: string[] = [];

    if (startDate && endDate) {
      parts.push(`from ${format(startDate, 'PPP')} to ${format(endDate, 'PPP')}`);
    } else if (startDate) {
      parts.push(`from ${format(startDate, 'PPP')} onwards`);
    } else if (endDate) {
      parts.push(`up to ${format(endDate, 'PPP')}`);
    }

    if (selectedExercise) {
      const exercise = exercisesList.find((e) => e.id === parseInt(selectedExercise));
      if (exercise) parts.push(`for exercise "${exercise.name}"`);
    }

    if (selectedCategory) {
      const category = categoriesList.find((c) => c.id === parseInt(selectedCategory));
      if (category) parts.push(`in category "${category.name}"`);
    }

    if (parts.length === 0) {
      return 'all training history';
    }

    return `training logs ${parts.join(' ')}`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Training History
            </DialogTitle>
            <DialogDescription>
              Permanently delete training logs matching the criteria below. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Date Range */}
            <div className="space-y-2">
              <Label>Date Range (Optional)</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('flex-1 justify-start text-left font-normal', !startDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, 'PPP') : 'Start date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                  </PopoverContent>
                </Popover>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('flex-1 justify-start text-left font-normal', !endDate && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, 'PPP') : 'End date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Exercise Filter */}
            <div className="space-y-2">
              <Label>Exercise (Optional)</Label>
              <Select value={selectedExercise} onValueChange={setSelectedExercise}>
                <SelectTrigger>
                  <SelectValue placeholder="All exercises" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All exercises</SelectItem>
                  {exercisesList.map((exercise) => (
                    <SelectItem key={exercise.id} value={exercise.id.toString()}>
                      {exercise.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <Label>Category (Optional)</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  {categoriesList.map((category) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Warning */}
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <p className="text-sm text-destructive">
                <strong>Warning:</strong> You are about to delete {getDeleteSummary()}. This action is permanent and
                cannot be undone.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => setShowConfirmation(true)}>
              Delete History
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {getDeleteSummary()}. This action cannot be undone. All related data will be
              lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground" disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Yes, delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
