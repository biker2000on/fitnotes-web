// Body slice: body weight logging, goals, and measurements.
// Code moved verbatim from FitNotesStore.tsx.
import { useState } from 'react';
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
  const { late, triggerToast, selectedDate, userUnit } = deps;

  const [bodyWeights, setBodyWeights] = useState<BodyWeight[]>([]);

  // Bodyweight Logger
  const [newWeight, setNewWeight] = useState('75');
  const [newFat, setNewFat] = useState('15');

  // Goals + Measurements data
  const [goals, setGoals] = useState<Goal[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [measurementRecords, setMeasurementRecords] = useState<MeasurementRecord[]>([]);

  const handleAddWeight = async () => {
    const parsedWeight = parseFloat(newWeight);
    const measuredAt = new Date();
    const selectedDay = new Date(`${selectedDate}T00:00:00`);
    if (!Number.isNaN(selectedDay.getTime())) {
      measuredAt.setFullYear(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate());
    }
    const record: BodyWeight = {
      id: uuidv4(),
      date: selectedDate,
      measured_at: measuredAt.toISOString(),
      body_weight_metric: userUnit === 'lbs' ? lbsToKg(parsedWeight) : parsedWeight,
      body_fat: newFat ? parseFloat(newFat) : null
    };
    await db.execute('INSERT INTO body_weights', [record]);
    await late.refreshData();
    triggerToast('Weight logged successfully!');
  };

  // ---- Goals ----
  const saveGoal = async (goal: Goal) => {
    await db.execute('INSERT INTO goals', [goal]);
    await late.refreshData();
    triggerToast('Goal saved!');
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
    triggerToast('Measurement saved!');
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
    triggerToast('Record logged!');
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
    handleAddWeight, saveGoal, deleteGoal, loadMeasurementRecords,
    saveMeasurement, deleteMeasurement, saveMeasurementRecord, deleteMeasurementRecord,
  };
}
