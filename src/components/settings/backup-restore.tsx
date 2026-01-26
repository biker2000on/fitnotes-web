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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { restoreBackup } from '@/actions/backup';
import { toast } from 'sonner';

interface BackupRestoreProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BackupPreview {
  version: string;
  exportDate: string;
  counts: {
    exercises: number;
    categories: number;
    trainingLogs: number;
    routines: number;
    goals: number;
    measurements: number;
  };
}

export function BackupRestore({ open, onOpenChange }: BackupRestoreProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState<'skip' | 'overwrite' | 'merge'>('skip');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreComplete, setRestoreComplete] = useState(false);
  const [restoreSummary, setRestoreSummary] = useState<any>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    try {
      const text = await selectedFile.text();
      const data = JSON.parse(text);

      setFile(selectedFile);
      setFileContent(text);
      setPreview({
        version: data.version || 'Unknown',
        exportDate: data.exportDate || 'Unknown',
        counts: {
          exercises: data.exercises?.length || 0,
          categories: data.categories?.length || 0,
          trainingLogs: data.trainingLogs?.length || 0,
          routines: data.routines?.length || 0,
          goals: data.goals?.length || 0,
          measurements: data.measurements?.length || 0,
        },
      });
    } catch (error) {
      toast.error('Invalid file', {
        description: 'The selected file is not a valid backup file',
      });
    }
  };

  const handleRestore = async () => {
    if (!fileContent) return;

    setIsRestoring(true);
    try {
      const result = await restoreBackup(fileContent, { conflictStrategy });

      setRestoreSummary(result);
      setRestoreComplete(true);

      if (result.success) {
        toast.success('Restore successful', {
          description: result.message,
        });
      } else {
        toast.error('Restore failed', {
          description: result.message,
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: 'An unexpected error occurred during restore',
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setFileContent(null);
    setPreview(null);
    setRestoreComplete(false);
    setRestoreSummary(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Restore Backup</DialogTitle>
          <DialogDescription>
            Upload a backup file to restore your data. Choose how to handle conflicts with existing data.
          </DialogDescription>
        </DialogHeader>

        {!restoreComplete ? (
          <div className="space-y-4">
            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="backup-file">Backup File</Label>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" className="w-full">
                  <label htmlFor="backup-file" className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    {file ? file.name : 'Choose File'}
                  </label>
                </Button>
                <input
                  id="backup-file"
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* Preview */}
            {preview && (
              <Alert>
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Backup Preview</p>
                    <div className="text-sm space-y-1">
                      <p>Version: {preview.version}</p>
                      <p>Date: {new Date(preview.exportDate).toLocaleDateString()}</p>
                      <div className="mt-2">
                        <p className="font-medium">Items to restore:</p>
                        <ul className="list-disc list-inside ml-2">
                          {preview.counts.categories > 0 && <li>{preview.counts.categories} categories</li>}
                          {preview.counts.exercises > 0 && <li>{preview.counts.exercises} exercises</li>}
                          {preview.counts.trainingLogs > 0 && <li>{preview.counts.trainingLogs} training logs</li>}
                          {preview.counts.routines > 0 && <li>{preview.counts.routines} routines</li>}
                          {preview.counts.goals > 0 && <li>{preview.counts.goals} goals</li>}
                          {preview.counts.measurements > 0 && <li>{preview.counts.measurements} measurements</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Conflict Strategy */}
            {preview && (
              <div className="space-y-2">
                <Label>Conflict Resolution</Label>
                <RadioGroup value={conflictStrategy} onValueChange={(value: any) => setConflictStrategy(value)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="skip" id="skip" />
                    <Label htmlFor="skip" className="font-normal">
                      Skip existing items (recommended)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="overwrite" id="overwrite" />
                    <Label htmlFor="overwrite" className="font-normal">
                      Overwrite existing items
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="merge" id="merge" />
                    <Label htmlFor="merge" className="font-normal">
                      Merge (keep both versions)
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            {/* Warning */}
            {preview && conflictStrategy === 'overwrite' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Warning: This will overwrite existing data with the same names. This action cannot be undone.
                </AlertDescription>
              </Alert>
            )}

            {/* Progress */}
            {isRestoring && (
              <div className="space-y-2">
                <Label>Restoring backup...</Label>
                <Progress value={undefined} className="w-full" />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Success Summary */}
            {restoreSummary?.success ? (
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Restore Complete</p>
                    <div className="text-sm space-y-1">
                      <p>Successfully restored:</p>
                      <ul className="list-disc list-inside ml-2">
                        {restoreSummary.counts.categories > 0 && (
                          <li>{restoreSummary.counts.categories} categories</li>
                        )}
                        {restoreSummary.counts.exercises > 0 && <li>{restoreSummary.counts.exercises} exercises</li>}
                        {restoreSummary.counts.trainingLogs > 0 && (
                          <li>{restoreSummary.counts.trainingLogs} training logs</li>
                        )}
                        {restoreSummary.counts.routines > 0 && <li>{restoreSummary.counts.routines} routines</li>}
                        {restoreSummary.counts.goals > 0 && <li>{restoreSummary.counts.goals} goals</li>}
                        {restoreSummary.counts.measurements > 0 && (
                          <li>{restoreSummary.counts.measurements} measurements</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Restore Failed</p>
                    <p className="text-sm">{restoreSummary?.message}</p>
                    {restoreSummary?.errors && restoreSummary.errors.length > 0 && (
                      <ul className="list-disc list-inside ml-2 text-sm">
                        {restoreSummary.errors.map((error: string, index: number) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter>
          {!restoreComplete ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleRestore} disabled={!preview || isRestoring}>
                {isRestoring ? 'Restoring...' : 'Restore'}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
