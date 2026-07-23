// muscles.ts - Canonical muscle vocabulary + fuzzy parser for the free-text
// primary_muscles / secondary_muscles exercise fields.

export type MuscleKey =
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'traps'
  | 'lats'
  | 'upper_back'
  | 'lower_back'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'adductors'
  | 'abductors'
  | 'neck'
  | 'hip_flexors';

export const MUSCLE_DISPLAY: Record<MuscleKey, string> = {
  chest: 'Chest',
  front_delts: 'Front Delts',
  side_delts: 'Side Delts',
  rear_delts: 'Rear Delts',
  traps: 'Traps',
  lats: 'Lats',
  upper_back: 'Upper Back',
  lower_back: 'Lower Back',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  obliques: 'Obliques',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  adductors: 'Adductors',
  abductors: 'Abductors',
  neck: 'Neck',
  hip_flexors: 'Hip Flexors',
};

export const ALL_MUSCLES = Object.keys(MUSCLE_DISPLAY) as MuscleKey[];

// Synonyms map: normalized token -> canonical keys. A token can expand to
// several regions (e.g. "shoulders" lights all three delt heads).
const SYNONYMS: Record<string, MuscleKey[]> = {
  chest: ['chest'], pecs: ['chest'], pectorals: ['chest'], pectoralismajor: ['chest'], pec: ['chest'],
  frontdelts: ['front_delts'], frontdelt: ['front_delts'], anteriordeltoid: ['front_delts'], anteriordelts: ['front_delts'], frontdeltoids: ['front_delts'],
  sidedelts: ['side_delts'], sidedelt: ['side_delts'], lateraldeltoid: ['side_delts'], lateraldelts: ['side_delts'], medialdeltoid: ['side_delts'], sidedeltoids: ['side_delts'],
  reardelts: ['rear_delts'], reardelt: ['rear_delts'], posteriordeltoid: ['rear_delts'], posteriordelts: ['rear_delts'], reardeltoids: ['rear_delts'],
  delts: ['front_delts', 'side_delts', 'rear_delts'], deltoids: ['front_delts', 'side_delts', 'rear_delts'], shoulders: ['front_delts', 'side_delts', 'rear_delts'], shoulder: ['front_delts', 'side_delts', 'rear_delts'],
  traps: ['traps'], trap: ['traps'], trapezius: ['traps'],
  lats: ['lats'], lat: ['lats'], latissimus: ['lats'], latissimusdorsi: ['lats'],
  upperback: ['upper_back'], midback: ['upper_back'], middleback: ['upper_back'], rhomboids: ['upper_back'], teresmajor: ['upper_back'],
  lowerback: ['lower_back'], erectors: ['lower_back'], erectorspinae: ['lower_back'], spinalerectors: ['lower_back'],
  back: ['lats', 'upper_back', 'lower_back'],
  biceps: ['biceps'], bicep: ['biceps'], brachialis: ['biceps'],
  triceps: ['triceps'], tricep: ['triceps'],
  forearms: ['forearms'], forearm: ['forearms'], brachioradialis: ['forearms'], grip: ['forearms'], wrists: ['forearms'],
  abs: ['abs'], abdominals: ['abs'], rectusabdominis: ['abs'], sixpack: ['abs'],
  core: ['abs', 'obliques'],
  obliques: ['obliques'], oblique: ['obliques'],
  quads: ['quads'], quad: ['quads'], quadriceps: ['quads'],
  hamstrings: ['hamstrings'], hamstring: ['hamstrings'], hams: ['hamstrings'],
  glutes: ['glutes'], glute: ['glutes'], gluteus: ['glutes'], gluteusmaximus: ['glutes'], butt: ['glutes'],
  calves: ['calves'], calf: ['calves'], gastrocnemius: ['calves'], soleus: ['calves'],
  adductors: ['adductors'], adductor: ['adductors'], innerthigh: ['adductors'], groin: ['adductors'],
  abductors: ['abductors'], abductor: ['abductors'], outerthigh: ['abductors'], gluteusmedius: ['abductors'], tfl: ['abductors'],
  neck: ['neck'],
  hipflexors: ['hip_flexors'], hipflexor: ['hip_flexors'], psoas: ['hip_flexors'],
  legs: ['quads', 'hamstrings', 'glutes', 'calves'],
  arms: ['biceps', 'triceps', 'forearms'],
  fullbody: ['quads', 'hamstrings', 'glutes', 'chest', 'lats', 'front_delts', 'abs'],
};

// Parse a free-text muscle list ("Chest, Front Delts / Triceps") into a set of
// canonical muscle keys. Unknown tokens are ignored.
export function parseMuscles(text: string | null | undefined): Set<MuscleKey> {
  const result = new Set<MuscleKey>();
  if (!text) return result;
  for (const raw of text.split(/[,;/|+]/)) {
    const token = raw.toLowerCase().replace(/[^a-z]/g, '');
    if (!token) continue;
    const keys = SYNONYMS[token];
    if (keys) keys.forEach(k => result.add(k));
  }
  return result;
}

export interface MuscleTargets {
  primary: Set<MuscleKey>;
  secondary: Set<MuscleKey>;
}

// Targets for a single exercise. Secondary never overrides primary.
export function exerciseMuscleTargets(ex: { primary_muscles?: string | null; secondary_muscles?: string | null }): MuscleTargets {
  const primary = parseMuscles(ex.primary_muscles);
  const secondary = parseMuscles(ex.secondary_muscles);
  primary.forEach(k => secondary.delete(k));
  return { primary, secondary };
}

// Aggregate targets for a workout: a muscle that is primary in ANY exercise is
// primary overall; otherwise it shows as secondary if any exercise lists it.
export function aggregateMuscleTargets(
  exercises: Array<{ primary_muscles?: string | null; secondary_muscles?: string | null }>,
): MuscleTargets {
  const primary = new Set<MuscleKey>();
  const secondary = new Set<MuscleKey>();
  for (const ex of exercises) {
    parseMuscles(ex.primary_muscles).forEach(k => primary.add(k));
    parseMuscles(ex.secondary_muscles).forEach(k => secondary.add(k));
  }
  primary.forEach(k => secondary.delete(k));
  return { primary, secondary };
}
