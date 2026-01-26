import Database from 'better-sqlite3';
import { db } from '@/db';
import { categories, exercises, trainingLogs } from '@/db/schema';

interface ImportProgress {
  phase: 'categories' | 'exercises' | 'logs' | 'complete';
  current: number;
  total: number;
  message: string;
}

// Convert FitNotes ARGB color int to hex
function argbToHex(argb: number): string {
  const hex = ((argb & 0xFFFFFF) >>> 0).toString(16).padStart(6, '0');
  return `#${hex}`;
}

export async function importFitNotesBackup(
  sqlitePath: string,
  userId: string,
  onProgress?: (progress: ImportProgress) => void
): Promise<{ success: boolean; error?: string; stats?: any }> {
  const sqlite = new Database(sqlitePath, { readonly: true });

  try {
    // 1. Import categories
    const fitnotesCategories = sqlite.prepare('SELECT * FROM Category ORDER BY sort_order').all() as any[];
    onProgress?.({ phase: 'categories', current: 0, total: fitnotesCategories.length, message: 'Importing categories...' });

    const categoryIdMap = new Map<number, number>(); // old ID -> new ID

    for (let i = 0; i < fitnotesCategories.length; i++) {
      const cat = fitnotesCategories[i];
      const inserted = await db.insert(categories).values({
        userId,
        name: cat.name,
        color: argbToHex(cat.colour),
        sortOrder: cat.sort_order,
      }).returning();
      if (inserted[0]) {
        categoryIdMap.set(cat._id, inserted[0].id);
      }
      onProgress?.({ phase: 'categories', current: i + 1, total: fitnotesCategories.length, message: `Imported category: ${cat.name}` });
    }

    // 2. Import exercises
    const fitnotesExercises = sqlite.prepare('SELECT * FROM exercise ORDER BY name').all() as any[];
    onProgress?.({ phase: 'exercises', current: 0, total: fitnotesExercises.length, message: 'Importing exercises...' });

    const exerciseIdMap = new Map<number, number>();

    for (let i = 0; i < fitnotesExercises.length; i++) {
      const ex = fitnotesExercises[i];
      const newCategoryId = categoryIdMap.get(ex.category_id);
      if (!newCategoryId) continue;

      const inserted = await db.insert(exercises).values({
        userId,
        name: ex.name,
        categoryId: newCategoryId,
        exerciseTypeId: ex.exercise_type_id,
        notes: ex.notes || null,
        weightIncrement: ex.weight_increment || null,
        defaultGraphId: ex.default_graph_id || null,
        defaultRestTime: ex.default_rest_time || null,
        weightUnitId: ex.weight_unit_id,
        isFavorite: ex.is_favourite === 1,
      }).returning();
      if (inserted[0]) {
        exerciseIdMap.set(ex._id, inserted[0].id);
      }
      onProgress?.({ phase: 'exercises', current: i + 1, total: fitnotesExercises.length, message: `Imported exercise: ${ex.name}` });
    }

    // 3. Import training logs
    const fitnotesLogs = sqlite.prepare('SELECT * FROM training_log ORDER BY date, _id').all() as any[];
    onProgress?.({ phase: 'logs', current: 0, total: fitnotesLogs.length, message: 'Importing workout logs...' });

    let logsImported = 0;
    const batchSize = 100;

    for (let i = 0; i < fitnotesLogs.length; i += batchSize) {
      const batch = fitnotesLogs.slice(i, i + batchSize);
      const values = batch.map(log => {
        const newExerciseId = exerciseIdMap.get(log.exercise_id);
        if (!newExerciseId) return null;

        return {
          exerciseId: newExerciseId,
          workoutDate: log.date,
          metricWeight: log.metric_weight,
          reps: log.reps,
          unit: log.unit,
          distance: log.distance,
          durationSeconds: log.duration_seconds,
          isPersonalRecord: log.is_personal_record === 1,
          isPersonalRecordFirst: log.is_personal_record_first === 1,
          isComplete: log.is_complete === 1,
          sortOrder: logsImported,
        };
      }).filter(Boolean);

      if (values.length > 0) {
        await db.insert(trainingLogs).values(values as any);
        logsImported += values.length;
      }

      onProgress?.({
        phase: 'logs',
        current: Math.min(i + batchSize, fitnotesLogs.length),
        total: fitnotesLogs.length,
        message: `Imported ${logsImported} workout sets...`
      });
    }

    onProgress?.({ phase: 'complete', current: 1, total: 1, message: 'Import complete!' });

    return {
      success: true,
      stats: {
        categories: categoryIdMap.size,
        exercises: exerciseIdMap.size,
        logs: logsImported,
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  } finally {
    sqlite.close();
  }
}
