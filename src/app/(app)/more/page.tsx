import { Header } from '@/components/layout/header';
import Link from 'next/link';
import { Upload, Calculator, Database, Target, Settings } from 'lucide-react';

export default function MorePage() {
  return (
    <div>
      <Header title="More" />
      <div className="p-4 space-y-2">
        <Link
          href="/settings"
          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors"
        >
          <Settings className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">Settings</p>
            <p className="text-sm text-muted-foreground">Configure app preferences and account settings</p>
          </div>
        </Link>
        <Link
          href="/goals"
          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors"
        >
          <Target className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">Goals</p>
            <p className="text-sm text-muted-foreground">Set and track fitness goals</p>
          </div>
        </Link>
        <Link
          href="/tools"
          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors"
        >
          <Calculator className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">Training Tools</p>
            <p className="text-sm text-muted-foreground">Plate calculator, 1RM calculator, and more</p>
          </div>
        </Link>
        <Link
          href="/more/backup"
          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors"
        >
          <Database className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">Backup & Export</p>
            <p className="text-sm text-muted-foreground">Backup, restore, and export your training data</p>
          </div>
        </Link>
        <Link
          href="/more/import"
          className="flex items-center gap-3 p-4 rounded-lg border hover:bg-accent transition-colors"
        >
          <Upload className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="font-medium">Import FitNotes Data</p>
            <p className="text-sm text-muted-foreground">Import from FitNotes backup file</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
