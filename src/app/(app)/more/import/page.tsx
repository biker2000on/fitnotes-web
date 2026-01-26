'use client';

import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Header } from '@/components/layout/header';

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: boolean; stats?: any; error?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      setResult(data);
      setProgress(100);
    } catch (error) {
      setResult({ success: false, error: 'Import failed' });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div>
      <Header title="Import Data" />
      <div className="p-4 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Import FitNotes Backup</CardTitle>
            <CardDescription>
              Upload your FitNotes backup file (.sqlite) to import your workout history.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="file"
              accept=".sqlite"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="hidden"
            />

            <Button
              variant="outline"
              className="w-full h-32 border-dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
            >
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span>{file ? file.name : 'Select FitNotes backup file'}</span>
              </div>
            </Button>

            {file && !isImporting && !result && (
              <Button onClick={handleImport} className="w-full">
                Start Import
              </Button>
            )}

            {isImporting && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing...
                </p>
              </div>
            )}

            {result && (
              <div className={`p-4 rounded-lg ${result.success ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                {result.success ? (
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Import successful!</p>
                      <p className="text-sm text-muted-foreground">
                        Imported {result.stats?.categories} categories, {result.stats?.exercises} exercises, and {result.stats?.logs} workout sets.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <p className="font-medium">Import failed</p>
                      <p className="text-sm text-muted-foreground">{result.error}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
