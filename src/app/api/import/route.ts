import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { importFitNotesBackup } from '@/lib/fitnotes-import';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  }

  if (!file.name.endsWith('.sqlite')) {
    return NextResponse.json({ error: 'File must be a SQLite database' }, { status: 400 });
  }

  // Save file temporarily
  const tempDir = join(process.cwd(), 'temp');
  await mkdir(tempDir, { recursive: true });
  const tempPath = join(tempDir, `import-${session.user.id}-${Date.now()}.sqlite`);

  const bytes = await file.arrayBuffer();
  await writeFile(tempPath, Buffer.from(bytes));

  try {
    const result = await importFitNotesBackup(tempPath, session.user.id);
    return NextResponse.json(result);
  } finally {
    // Clean up temp file
    await unlink(tempPath).catch(() => {});
  }
}
