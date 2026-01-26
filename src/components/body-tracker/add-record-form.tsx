'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const recordSchema = z.object({
  date: z.date(),
  value: z.number().positive('Value must be positive'),
  comment: z.string().optional(),
});

type RecordFormData = z.infer<typeof recordSchema>;

interface AddRecordFormProps {
  onSubmit: (data: RecordFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  unitName: string;
}

export function AddRecordForm({ onSubmit, onCancel, isLoading, unitName }: AddRecordFormProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<RecordFormData>({
    resolver: zodResolver(recordSchema),
    defaultValues: {
      date: new Date(),
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input
          id="date"
          type="date"
          {...register('date', { valueAsDate: true })}
          defaultValue={new Date().toISOString().split('T')[0]}
        />
        {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="value">Value ({unitName})</Label>
        <Input
          id="value"
          type="number"
          step="0.1"
          {...register('value', { valueAsNumber: true })}
          placeholder={`e.g., 75`}
        />
        {errors.value && <p className="text-sm text-destructive">{errors.value.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="comment">Comment (optional)</Label>
        <Textarea
          id="comment"
          {...register('comment')}
          placeholder="Add a note..."
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? 'Adding...' : 'Add Record'}
        </Button>
      </div>
    </form>
  );
}
