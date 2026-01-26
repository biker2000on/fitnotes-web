
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

const exerciseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  categoryId: z.number().int().positive('Category is required'),
  exerciseTypeId: z.number().int().min(0).max(9),
  notes: z.string().optional(),
  isFavorite: z.boolean(),
});

type ExerciseFormData = z.infer<typeof exerciseSchema>;

interface ExerciseFormProps {
  categories: { id: number; name: string; color: string }[];
  defaultValues?: Partial<ExerciseFormData>;
  onSubmit: (data: ExerciseFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

import { EXERCISE_TYPES } from '@/lib/exercise-types';

const exerciseTypes = EXERCISE_TYPES;

export function ExerciseForm({ categories, defaultValues, onSubmit, onCancel, isLoading }: ExerciseFormProps) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ExerciseFormData>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: { exerciseTypeId: 0, isFavorite: false, ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Exercise Name</Label>
        <Input id="name" {...register('name')} placeholder="e.g., Bench Press" />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Select onValueChange={(v) => setValue('categoryId', parseInt(v))} defaultValue={defaultValues?.categoryId?.toString()}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                  {cat.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Exercise Type</Label>
        <Select onValueChange={(v) => setValue('exerciseTypeId', parseInt(v))} defaultValue={defaultValues?.exerciseTypeId?.toString() || '0'}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {exerciseTypes.map((type) => (
              <SelectItem key={type.id} value={type.id.toString()}>{type.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" {...register('notes')} placeholder="Exercise notes..." />
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="favorite">Favorite</Label>
        <Switch id="favorite" checked={watch('isFavorite')} onCheckedChange={(v) => setValue('isFavorite', v)} />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
