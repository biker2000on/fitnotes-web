// Body slice: body weight logging, goals, and measurements.
// Code moved verbatim from FitNotesStore.tsx.
import { useState } from 'react';
import { getLocalDateString } from '../../lib/date';
import { db } from '../../storage/db';
import { uuidv4 } from '../../lib/uuid';
import { lbsToKg } from '../../lib/units';
import type { BodyWeight, Goal, Measurement, MeasurementRecord } from '../../types';
import type { LateDeps, TriggerToast } from './types';

export interface BodySliceDeps {
  late: LateDeps;
  triggerToast: TriggerToast;
  selectedDate: string;
  userUnit: 'kg' | 'lbs';
}

export function useBodySlice(deps: BodySliceDeps) {
  const { late, triggerToast, userUnit } = deps;

  const [bodyWeights, setBodyWeights] = useState<BodyWeight[]>([]);

  // Bodyweight Logger
  const [newWeight, setNewWeight] = useState('75');
  const [newFat, setNewFat] = useState('15');

  // Goals + Measurements data
  const [goals, setGoals] = useState<Goal[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [measurementRecords, setMeasurementRecords] = useState<MeasurementRecord[]>([]);

  // Body records default to today; the Log's browsing date must not leak in.
  const handleAddWeight = async (date: string = getLocalDateString()) => {
    const parsedWeight = parseFloat(newWeight);
    if (Number.isNaN(parsedWeight)) {
      triggerToast('Enter a weight to save.', 'error');
      return;
    }
    const measuredAt = new Date();
    const selectedDay = new Date(`${date}T00:00:00`);
    if (!Number.isNaN(selectedDay.getTime())) {
      measuredAt.setFullYear(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate());
    }
    const record: BodyWeight = {
      id: uuidv4(),
      date,
      measured_at: measuredAt.toISOString(),
      body_weight_metric: userUnit === 'lbs' ? lbsToKg(parsedWeight) : parsedWeight,
      body_fat: newFat ? parseFloat(newFat) : null
    };
    await db.execute('INSERT INTO body_weights', [record]);
    await late.refreshData();
    triggerToast('Weigh-in saved.');
  };

  const handleDeleteWeight = async (id: string) => {
    const existing = bodyWeights.find(b => b.id === id);
    if (!existing) return;
    await db.execute('INSERT INTO body_weights', [{ ...existing, is_deleted: true }]);
    await late.refreshData();
    triggerToast('Weigh-in deleted.', 'info', {
      label: 'Undo',
      onAction: async () => {
        await db.execute('INSERT INTO body_weights', [{ ...existing, is_deleted: false }]);
        await late.refreshData();
      },
    });
  };

  // ---- Goals ----
  const saveGoal = async (goal: Goal) => {
    await db.execute('INSERT INTO goals', [goal]);
    await late.refreshData();
    triggerToast('Goal saved.');
  };

  const deleteGoal = async (id: string) => {
    const existing = goals.find(g => g.id === id);
    if (existing) await db.execute('UPDATE goals', [{ ...existing, is_deleted: true }]);
    await late.refreshData();
    triggerToast('Goal deleted.');
  };

  // ---- Measurements ----
  const loadMeasurementRecords = async (measurementId: string) => {
    const recs = await db.query<MeasurementRecord>('SELECT * FROM measurement_records WHERE measurement_id = ?', [measurementId]);
    setMeasurementRecords(recs);
  };

  const saveMeasurement = async (m: Measurement) => {
    await db.execute('INSERT INTO measurements', [m]);
    await late.refreshData();
    triggerToast('Measurement saved.');
  };

  const deleteMeasurement = async (id: string) => {
    const existing = measurements.find(m => m.id === id);
    if (existing) await db.execute('UPDATE measurements', [{ ...existing, is_deleted: true }]);
    await late.refreshData();
    triggerToast('Measurement deleted.');
  };

  const saveMeasurementRecord = async (rec: MeasurementRecord) => {
    // Ensure the parent measurement is persisted before its record so the FK
    // holds locally and on sync (default measurements may still be virtual).
    const parent = measurements.find(m => m.id === rec.measurement_id);
    if (parent) await db.execute('INSERT INTO measurements', [parent]);
    await db.execute('INSERT INTO measurement_records', [rec]);
    await loadMeasurementRecords(rec.measurement_id);
    triggerToast('Saved.');
  };

  const deleteMeasurementRecord = async (id: string) => {
    const existing = measurementRecords.find(r => r.id === id);
    if (existing) {
      await db.execute('UPDATE measurement_records', [{ ...existing, is_deleted: true }]);
      await loadMeasurementRecords(existing.measurement_id);
    }
    triggerToast('Record deleted.');
  };

  return {
    bodyWeights, setBodyWeights, newWeight, setNewWeight, newFat, setNewFat,
    goals, setGoals, measurements, setMeasurements, measurementRecords, setMeasurementRecords,
    handleAddWeight, handleDeleteWeight, saveGoal, deleteGoal, loadMeasurementRecords,
    saveMeasurement, deleteMeasurement, saveMeasurementRecord, deleteMeasurementRecord,
  };
}
