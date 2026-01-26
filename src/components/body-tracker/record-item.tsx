import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';

type MeasurementRecord = {
  id: number;
  value: number;
  date: Date;
  comment: string | null;
};

interface RecordItemProps {
  record: MeasurementRecord;
  unitName: string;
  onDelete: (id: number) => void;
}

export function RecordItem({ record, unitName, onDelete }: RecordItemProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors">
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold">{record.value}</span>
          <span className="text-sm text-muted-foreground">{unitName}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {format(new Date(record.date), 'MMM d, yyyy')}
        </div>
        {record.comment && (
          <div className="text-sm text-muted-foreground mt-1">
            {record.comment}
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(record.id)}
      >
        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );
}
