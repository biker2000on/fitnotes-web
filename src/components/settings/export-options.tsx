'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, FileSpreadsheet, FileJson } from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportToCSV, exportToJSON } from '@/actions/backup';
import { toast } from 'sonner';

interface ExportOptionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportOptions({ open, onOpenChange }: ExportOptionsProps) {
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [includeOptions, setIncludeOptions] = useState({
    exercises: true,
    logs: true,
    routines: false,
    goals: false,
    measurements: false,
  });
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      let result;

      if (exportFormat === 'csv') {
        result = await exportToCSV({
          startDate: startDate?.toISOString().split('T')[0],
          endDate: endDate?.toISOString().split('T')[0],
          includeLogs: includeOptions.logs,
          includeExercises: includeOptions.exercises,
        });
      } else {
        const include: string[] = [];
        if (includeOptions.exercises) include.push('exercises');
        if (includeOptions.logs) include.push('logs');
        if (includeOptions.routines) include.push('routines');
        if (includeOptions.goals) include.push('goals');
        if (includeOptions.measurements) include.push('measurements');

        result = await exportToJSON({
          startDate: startDate?.toISOString().split('T')[0],
          endDate: endDate?.toISOString().split('T')[0],
          include,
        });
      }

      if (result.success && result.data) {
        // Create download
        const mimeType = exportFormat === 'csv' ? 'text/csv' : 'application/json';
        const extension = exportFormat === 'csv' ? 'csv' : 'json';
        const blob = new Blob([result.data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fitnotes-export-${new Date().toISOString().split('T')[0]}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success('Export successful', {
          description: `Your data has been exported as ${extension.toUpperCase()}`,
        });

        onOpenChange(false);
      } else {
        toast.error('Export failed', {
          description: result.error || 'Failed to export data',
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Data</DialogTitle>
          <DialogDescription>Choose what data to export and in which format</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV (Spreadsheet)
                  </div>
                </SelectItem>
                <SelectItem value="json">
                  <div className="flex items-center gap-2">
                    <FileJson className="h-4 w-4" />
                    JSON (Structured Data)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

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
            {startDate || endDate ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStartDate(undefined);
                  setEndDate(undefined);
                }}
                className="text-xs"
              >
                Clear dates
              </Button>
            ) : null}
          </div>

          {/* Include Options */}
          <div className="space-y-2">
            <Label>Include</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="exercises"
                  checked={includeOptions.exercises}
                  onCheckedChange={(checked) =>
                    setIncludeOptions((prev) => ({ ...prev, exercises: checked as boolean }))
                  }
                />
                <Label htmlFor="exercises" className="font-normal">
                  Exercises
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="logs"
                  checked={includeOptions.logs}
                  onCheckedChange={(checked) => setIncludeOptions((prev) => ({ ...prev, logs: checked as boolean }))}
                />
                <Label htmlFor="logs" className="font-normal">
                  Training Logs
                </Label>
              </div>

              {exportFormat === 'json' && (
                <>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="routines"
                      checked={includeOptions.routines}
                      onCheckedChange={(checked) =>
                        setIncludeOptions((prev) => ({ ...prev, routines: checked as boolean }))
                      }
                    />
                    <Label htmlFor="routines" className="font-normal">
                      Routines
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="goals"
                      checked={includeOptions.goals}
                      onCheckedChange={(checked) => setIncludeOptions((prev) => ({ ...prev, goals: checked as boolean }))}
                    />
                    <Label htmlFor="goals" className="font-normal">
                      Goals
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="measurements"
                      checked={includeOptions.measurements}
                      onCheckedChange={(checked) =>
                        setIncludeOptions((prev) => ({ ...prev, measurements: checked as boolean }))
                      }
                    />
                    <Label htmlFor="measurements" className="font-normal">
                      Measurements
                    </Label>
                  </div>
                </>
              )}
            </div>
          </div>

          {exportFormat === 'csv' && (
            <p className="text-xs text-muted-foreground">
              CSV export includes training logs with exercise and category information
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
