// Tools/analysis slice: plate calculator, analytics graph selection, graph
// favourites, and custom units. Code moved verbatim from FitNotesStore.tsx.
import { useState, useEffect } from 'react';
import { db } from '../../storage/db';
import type { GraphFavourite, CustomUnit } from '../../types';
import type { TriggerToast } from './types';

export interface ToolsSliceDeps {
  userUnit: 'kg' | 'lbs';
  triggerToast: TriggerToast;
}

export function useToolsSlice(deps: ToolsSliceDeps) {
  const { userUnit, triggerToast } = deps;

  const [graphFavourites, setGraphFavourites] = useState<GraphFavourite[]>([]);
  const [customUnits, setCustomUnits] = useState<CustomUnit[]>([]);

  const saveGraphFavourite = async (fav: GraphFavourite) => {
    await db.execute('INSERT INTO graph_favourites', [fav]);
    setGraphFavourites(await db.query<GraphFavourite>('SELECT * FROM graph_favourites'));
    triggerToast('Graph saved to favourites!');
  };
  const deleteGraphFavourite = async (id: string) => {
    const f = graphFavourites.find(x => x.id === id);
    if (f) await db.execute('UPDATE graph_favourites', [{ ...f, is_deleted: true }]);
    setGraphFavourites(await db.query<GraphFavourite>('SELECT * FROM graph_favourites'));
  };
  const saveCustomUnit = async (u: CustomUnit) => {
    await db.execute('INSERT INTO custom_units', [u]);
    setCustomUnits(await db.query<CustomUnit>('SELECT * FROM custom_units'));
    triggerToast('Custom unit saved!');
  };
  const deleteCustomUnit = async (id: string) => {
    const u = customUnits.find(x => x.id === id);
    if (u) await db.execute('UPDATE custom_units', [{ ...u, is_deleted: true }]);
    setCustomUnits(await db.query<CustomUnit>('SELECT * FROM custom_units'));
  };

  // Plate Calculator State
  const [showPlateCalc, setShowPlateCalc] = useState(false);
  const [plateCalcTarget, setPlateCalcTarget] = useState(100);
  const [calculatedPlates, setCalculatedPlates] = useState<Array<{ weight: number; count: number; color: string }>>([]);

  // Analytics graph selection
  const [analyticExerciseId, setAnalyticExerciseId] = useState<string>('');
  const [analyticMetric, setAnalyticMetric] = useState<'volume' | 'maxWeight' | 'estimated1RM'>('volume');

  // Plate Calculator Solver (Premium plate load drawings)
  const calculatePlatesSolver = (target: number) => {
    const barWeight = userUnit === 'kg' ? 20 : 45;
    const targetSides = (target - barWeight) / 2;
    if (targetSides <= 0) {
      setCalculatedPlates([]);
      return;
    }

    const availablePlates = userUnit === 'kg' ? [
      { weight: 20, color: '#ef4444' }, // Red
      { weight: 15, color: '#3b82f6' }, // Blue
      { weight: 10, color: '#10b981' }, // Green
      { weight: 5, color: '#f59e0b' },  // Yellow
      { weight: 2.5, color: '#94a3b8' } // Silver/Grey
    ] : [
      { weight: 45, color: '#ef4444' }, // Red
      { weight: 35, color: '#3b82f6' }, // Blue
      { weight: 25, color: '#10b981' }, // Green
      { weight: 10, color: '#f59e0b' }, // Yellow
      { weight: 5, color: '#94a3b8' },  // Silver/Grey
      { weight: 2.5, color: '#a855f7' } // Purple
    ];

    let remainder = targetSides;
    const result: Array<{ weight: number; count: number; color: string }> = [];

    for (const plate of availablePlates) {
      const count = Math.floor(remainder / plate.weight);
      if (count > 0) {
        result.push({ weight: plate.weight, count, color: plate.color });
        remainder -= count * plate.weight;
      }
    }
    setCalculatedPlates(result);
  };

  useEffect(() => {
    calculatePlatesSolver(plateCalcTarget);
  }, [plateCalcTarget, userUnit]);

  return {
    graphFavourites, setGraphFavourites, saveGraphFavourite, deleteGraphFavourite,
    customUnits, setCustomUnits, saveCustomUnit, deleteCustomUnit,
    showPlateCalc, setShowPlateCalc, plateCalcTarget, setPlateCalcTarget,
    calculatedPlates, setCalculatedPlates, calculatePlatesSolver,
    analyticExerciseId, setAnalyticExerciseId, analyticMetric, setAnalyticMetric,
  };
}
