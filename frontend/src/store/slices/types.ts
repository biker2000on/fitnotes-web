// Late-bound dependencies shared across slices.
//
// Some functions/values have circular relationships between slices (e.g. the
// settings slice's handleUnitChange must nudge the workout slice's log weight,
// while the workout slice needs settings; every slice needs refreshData, which
// itself needs every slice's setters). The controller fills this stable object
// on every render AFTER all slices have run; slices only ever access its
// properties at call time (event handlers / effects), never during render, so
// each call resolves to the current render's closure - the same semantics the
// original single-closure controller had.
import type { Dispatch, SetStateAction } from 'react';
import type { TrainingLog } from '../../types';

export interface LateDeps {
  refreshData: (date?: string) => Promise<void>;
  refreshDateData: (date?: string) => Promise<void>;
  allLogs: TrainingLog[];
  setLogWeight: Dispatch<SetStateAction<string>>;
  setPlateCalcTarget: Dispatch<SetStateAction<number>>;
}

export type TriggerToast = (msg: string, type?: 'success' | 'error' | 'info') => void;
export type TriggerConfirm = (
  title: string,
  msg: string,
  onApprove: () => void,
  options?: { approveLabel?: string; tone?: 'default' | 'danger' },
) => void;
