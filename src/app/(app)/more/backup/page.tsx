'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Upload, Trash2, FileJson, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { BackupRestore } from '@/components/settings/backup-restore';
import { ExportOptions } from '@/components/settings/export-options';
import { DeleteHistoryDialog } from '@/components/settings/delete-history-dialog';
import { createBackup } from '@/actions/backup';
import { toast } from 'sonner';

export default function BackupPage() {
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleCreateBackup = async () => {
    setIsCreatingBackup(true);
    try {
      const result = await createBackup();

      if (result.success && result.data) {
        // Create download
        const blob = new Blob([result.data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fitnotes-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success('Backup created', {
          description: 'Your backup file has been downloaded',
        });
      } else {
        toast.error('Backup failed', {
          description: result.error || 'Failed to create backup',
        });
      }
    } catch (error) {
      toast.error('Error', {
        description: 'An unexpected error occurred',
      });
    } finally {
      setIsCreatingBackup(false);
    }
  };

  return (
    <div>
      <Header title="Backup & Export" />
      <div className="p-4 space-y-4">
        {/* Backup Section */}
        <Card>
          <CardHeader>
            <CardTitle>Backup & Restore</CardTitle>
            <CardDescription>Create a complete backup of all your data or restore from a previous backup</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={handleCreateBackup} disabled={isCreatingBackup} className="w-full">
              <Download className="mr-2 h-4 w-4" />
              {isCreatingBackup ? 'Creating Backup...' : 'Create Backup'}
            </Button>
            <Button onClick={() => setShowRestoreDialog(true)} variant="outline" className="w-full">
              <Upload className="mr-2 h-4 w-4" />
              Restore Backup
            </Button>
            <p className="text-xs text-muted-foreground">
              Backup includes: exercises, categories, training logs, routines, goals, measurements, and settings
            </p>
          </CardContent>
        </Card>

        {/* Export Section */}
        <Card>
          <CardHeader>
            <CardTitle>Export Data</CardTitle>
            <CardDescription>Export your training data in different formats</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button onClick={() => setShowExportDialog(true)} variant="outline" className="w-full">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export to CSV/JSON
            </Button>
            <p className="text-xs text-muted-foreground">
              Export specific data ranges or data types in CSV or JSON format
            </p>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>Irreversible actions - use with caution</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowDeleteDialog(true)} variant="destructive" className="w-full">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Training History
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Permanently delete training logs matching specific criteria
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <BackupRestore open={showRestoreDialog} onOpenChange={setShowRestoreDialog} />
      <ExportOptions open={showExportDialog} onOpenChange={setShowExportDialog} />
      <DeleteHistoryDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} />
    </div>
  );
}
