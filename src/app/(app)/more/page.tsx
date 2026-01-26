import { Header } from '@/components/layout/header';
import Link from 'next/link';
import { Upload } from 'lucide-react';

export default function MorePage() {
  return (
    <div>
      <Header title="More" />
      <div className="p-4 space-y-2">
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
