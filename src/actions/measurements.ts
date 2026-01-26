'use server';

import { db } from '@/db';
import { measurements, measurementRecords } from '@/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { requireAuth } from '@/lib/auth-utils';
import { revalidatePath } from 'next/cache';

interface CreateMeasurementData {
  name: string;
  unitId: number;
  goalType?: number;
  goalValue?: number;
  goalDate?: Date;
  sortOrder?: number;
  isDefault?: boolean;
}

interface UpdateMeasurementData {
  name?: string;
  unitId?: number;
  goalType?: number;
  goalValue?: number;
  goalDate?: Date;
  sortOrder?: number;
}

interface AddRecordData {
  measurementId: number;
  date: Date;
  value: number;
  comment?: string;
}

export async function createMeasurement(data: CreateMeasurementData) {
  const user = await requireAuth();

  const [measurement] = await db.insert(measurements).values({
    ...data,
    userId: user.id,
  }).returning();

  revalidatePath('/body-tracker');
  return measurement;
}

export async function getMeasurements() {
  const user = await requireAuth();

  const userMeasurements = await db.query.measurements.findMany({
    where: eq(measurements.userId, user.id),
    orderBy: [asc(measurements.sortOrder), asc(measurements.name)],
    with: {
      records: {
        orderBy: [desc(measurementRecords.date)],
        limit: 1,
      },
    },
  });

  return userMeasurements;
}

export async function getMeasurement(id: number) {
  const user = await requireAuth();

  const measurement = await db.query.measurements.findFirst({
    where: and(eq(measurements.id, id), eq(measurements.userId, user.id)),
    with: {
      records: {
        orderBy: [desc(measurementRecords.date)],
        limit: 30,
      },
    },
  });

  return measurement;
}

export async function updateMeasurement(id: number, data: UpdateMeasurementData) {
  const user = await requireAuth();

  const [measurement] = await db.update(measurements)
    .set(data)
    .where(and(eq(measurements.id, id), eq(measurements.userId, user.id)))
    .returning();

  revalidatePath('/body-tracker');
  revalidatePath(`/body-tracker/${id}`);
  return measurement;
}

export async function deleteMeasurement(id: number) {
  const user = await requireAuth();

  await db.delete(measurements)
    .where(and(eq(measurements.id, id), eq(measurements.userId, user.id)));

  revalidatePath('/body-tracker');
}

export async function addMeasurementRecord(data: AddRecordData) {
  const user = await requireAuth();

  // Verify the measurement belongs to the user
  const measurement = await db.query.measurements.findFirst({
    where: and(
      eq(measurements.id, data.measurementId),
      eq(measurements.userId, user.id)
    ),
  });

  if (!measurement) {
    throw new Error('Measurement not found');
  }

  const [record] = await db.insert(measurementRecords).values(data).returning();

  revalidatePath('/body-tracker');
  revalidatePath(`/body-tracker/${data.measurementId}`);
  return record;
}

export async function getMeasurementHistory(measurementId: number, limit = 100) {
  const user = await requireAuth();

  // Verify the measurement belongs to the user
  const measurement = await db.query.measurements.findFirst({
    where: and(
      eq(measurements.id, measurementId),
      eq(measurements.userId, user.id)
    ),
  });

  if (!measurement) {
    throw new Error('Measurement not found');
  }

  const records = await db.query.measurementRecords.findMany({
    where: eq(measurementRecords.measurementId, measurementId),
    orderBy: [desc(measurementRecords.date)],
    limit,
  });

  return records;
}

export async function deleteMeasurementRecord(id: number) {
  const user = await requireAuth();

  // Get the record to find the measurementId for revalidation
  const record = await db.query.measurementRecords.findFirst({
    where: eq(measurementRecords.id, id),
    with: {
      measurement: true,
    },
  });

  if (!record) {
    throw new Error('Record not found');
  }

  // Verify the measurement belongs to the user
  if (record.measurement.userId !== user.id) {
    throw new Error('Unauthorized');
  }

  await db.delete(measurementRecords)
    .where(eq(measurementRecords.id, id));

  revalidatePath('/body-tracker');
  revalidatePath(`/body-tracker/${record.measurementId}`);
}

export async function createDefaultMeasurements() {
  const user = await requireAuth();

  // Check if user already has body weight measurement
  const existingBodyWeight = await db.query.measurements.findFirst({
    where: and(
      eq(measurements.userId, user.id),
      eq(measurements.isDefault, true)
    ),
  });

  if (existingBodyWeight) {
    return existingBodyWeight;
  }

  const [bodyWeight] = await db.insert(measurements).values({
    userId: user.id,
    name: 'Body Weight',
    unitId: 0, // kg by default
    isDefault: true,
    sortOrder: 0,
  }).returning();

  revalidatePath('/body-tracker');
  return bodyWeight;
}
