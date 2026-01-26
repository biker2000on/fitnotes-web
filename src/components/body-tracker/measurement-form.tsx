'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const measurementSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  unitId: z.number().int().min(0).max(3),
  goalType: z.number().int().min(0).max(3).optional(),
  goalValue: z.number().positive().optional(),
  goalDate: z.date().optional(),
});

type MeasurementFormData = z.infer<typeof measurementSchema>;

interface MeasurementFormProps {
  defaultValues?: Partial<MeasurementFormData>;
  onSubmit: (data: MeasurementFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const units = [
  { id: 0, name: 'kg' },
  { id: 1, name: 'lbs' },
  { id: 2, name: 'cm' },
  { id: 3, name: 'inches' },
];

const goalTypes = [
  { id: 0, name: 'None' },
  { id: 1, name: 'Increase' },
  { id: 2, name: 'Decrease' },
  { id: 3, name: 'Target' },
];

export function MeasurementForm({ defaultValues, onSubmit, onCancel, isLoading }: MeasurementFormProps) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<MeasurementFormData>({
    resolver: zodResolver(measurementSchema),
    defaultValues: { unitId: 0, goalType: 0, ...defaultValues },
  });

  const goalType = watch('goalType');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Measurement Name</Label>
        <Input id="name" {...register('name')} placeholder="e.g., Body Weight, Chest, Waist" />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Unit</Label>
        <Select onValueChange={(v) => setValue('unitId', parseInt(v))} defaultValue={defaultValues?.unitId?.toString() || '0'}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {units.map((unit) => (
              <SelectItem key={unit.id} value={unit.id.toString()}>{unit.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Goal Type</Label>
        <Select onValueChange={(v) => setValue('goalType', parseInt(v))} defaultValue={defaultValues?.goalType?.toString() || '0'}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {goalTypes.map((type) => (
              <SelectItem key={type.id} value={type.id.toString()}>{type.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {goalType !== undefined && goalType > 0 && (
        <>
          <div className="space-y-2">
            <Label htmlFor="goalValue">Goal Value</Label>
            <Input
              id="goalValue"
              type="number"
              step="0.1"
              {...register('goalValue', { valueAsNumber: true })}
              placeholder="e.g., 75"
            />
            {errors.goalValue && <p className="text-sm text-destructive">{errors.goalValue.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="goalDate">Goal Date (optional)</Label>
            <Input
              id="goalDate"
              type="date"
              {...register('goalDate', { valueAsDate: true })}
            />
          </div>
        </>
      )}

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
