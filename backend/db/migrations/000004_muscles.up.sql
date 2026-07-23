-- 000004_muscles.up.sql
-- Adds secondary_muscles and backfills primary/secondary muscle data for all
-- existing exercises (any user) whose names match the canonical FitNotes
-- defaults. Matching uses the same alphanumeric normalization as the
-- exercises_user_name_normalized_idx index. Only empty fields are filled, and
-- last_modified is bumped so every client pulls the enriched rows on next sync.

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS secondary_muscles TEXT;

WITH muscle_map(name_norm, prim, sec) AS (
  VALUES
    ('overheadpress', 'Front Delts, Side Delts', 'Triceps, Traps'),
    ('seateddumbbellpress', 'Front Delts, Side Delts', 'Triceps, Traps'),
    ('lateraldumbbellraise', 'Side Delts', 'Traps'),
    ('frontdumbbellraise', 'Front Delts', 'Side Delts, Chest'),
    ('pushpress', 'Front Delts, Side Delts', 'Triceps, Traps, Quads, Glutes'),
    ('behindtheneckbarbellpress', 'Front Delts, Side Delts', 'Triceps, Traps'),
    ('hammerstrengthshoulderpress', 'Front Delts, Side Delts', 'Triceps, Traps'),
    ('seateddumbbelllateralraise', 'Side Delts', 'Traps'),
    ('lateralmachineraise', 'Side Delts', 'Traps'),
    ('reardeltdumbbellraise', 'Rear Delts', 'Upper Back, Traps'),
    ('reardeltmachinefly', 'Rear Delts', 'Upper Back, Traps'),
    ('arnolddumbbellpress', 'Front Delts, Side Delts', 'Triceps, Traps'),
    ('onearmstandingdumbbellpress', 'Front Delts, Side Delts', 'Triceps, Traps, Obliques'),
    ('cablefacepull', 'Rear Delts, Upper Back', 'Traps, Biceps'),
    ('logpress', 'Front Delts, Side Delts', 'Triceps, Traps, Upper Back'),
    ('smithmachineoverheadpress', 'Front Delts, Side Delts', 'Triceps, Traps'),
    ('closegripbarbellbenchpress', 'Triceps, Chest', 'Front Delts'),
    ('vbarpushdown', 'Triceps', 'Forearms'),
    ('parallelbartricepsdip', 'Triceps, Chest', 'Front Delts'),
    ('lyingtricepsextension', 'Triceps', 'Forearms'),
    ('ropepushdown', 'Triceps', 'Forearms'),
    ('cableoverheadtricepsextension', 'Triceps', 'Forearms'),
    ('ezbarskullcrusher', 'Triceps', 'Forearms'),
    ('dumbbelloverheadtricepsextension', 'Triceps', 'Forearms'),
    ('ringdip', 'Triceps, Chest', 'Front Delts, Abs'),
    ('smithmachineclosegripbenchpress', 'Triceps, Chest', 'Front Delts'),
    ('barbellcurl', 'Biceps', 'Forearms'),
    ('ezbarcurl', 'Biceps', 'Forearms'),
    ('dumbbellcurl', 'Biceps', 'Forearms'),
    ('seatedinclinedumbbellcurl', 'Biceps', 'Forearms'),
    ('seatedmachinecurl', 'Biceps', 'Forearms'),
    ('dumbbellhammercurl', 'Biceps, Forearms', 'Front Delts'),
    ('cablecurl', 'Biceps', 'Forearms'),
    ('ezbarpreachercurl', 'Biceps', 'Forearms'),
    ('dumbbellconcentrationcurl', 'Biceps', 'Forearms'),
    ('dumbbellpreachercurl', 'Biceps', 'Forearms'),
    ('flatbarbellbenchpress', 'Chest', 'Front Delts, Triceps'),
    ('flatdumbbellbenchpress', 'Chest', 'Front Delts, Triceps'),
    ('inclinebarbellbenchpress', 'Chest, Front Delts', 'Triceps'),
    ('declinebarbellbenchpress', 'Chest', 'Triceps, Front Delts'),
    ('inclinedumbbellbenchpress', 'Chest, Front Delts', 'Triceps'),
    ('flatdumbbellfly', 'Chest', 'Front Delts'),
    ('inclinedumbbellfly', 'Chest', 'Front Delts'),
    ('cablecrossover', 'Chest', 'Front Delts'),
    ('inclinehammerstrengthchestpress', 'Chest, Front Delts', 'Triceps'),
    ('declinehammerstrengthchestpress', 'Chest', 'Triceps, Front Delts'),
    ('seatedmachinefly', 'Chest', 'Front Delts'),
    ('deadlift', 'Glutes, Hamstrings, Lower Back', 'Quads, Traps, Forearms, Lats'),
    ('pullup', 'Lats', 'Biceps, Upper Back, Forearms'),
    ('chinup', 'Lats, Biceps', 'Upper Back, Forearms'),
    ('neutralchinup', 'Lats, Biceps', 'Upper Back, Forearms'),
    ('dumbbellrow', 'Lats, Upper Back', 'Biceps, Rear Delts, Forearms'),
    ('barbellrow', 'Lats, Upper Back', 'Biceps, Rear Delts, Lower Back, Forearms'),
    ('pendlayrow', 'Lats, Upper Back', 'Biceps, Rear Delts, Lower Back'),
    ('latpulldown', 'Lats', 'Biceps, Upper Back, Forearms'),
    ('hammerstrengthrow', 'Lats, Upper Back', 'Biceps, Rear Delts'),
    ('seatedcablerow', 'Lats, Upper Back', 'Biceps, Rear Delts, Forearms'),
    ('tbarrow', 'Lats, Upper Back', 'Biceps, Rear Delts, Lower Back'),
    ('barbellshrug', 'Traps', 'Forearms, Neck'),
    ('machineshrug', 'Traps', 'Forearms, Neck'),
    ('straightarmcablepushdown', 'Lats', 'Triceps, Abs'),
    ('rackpull', 'Glutes, Lower Back', 'Hamstrings, Traps, Forearms, Lats'),
    ('goodmorning', 'Hamstrings, Glutes, Lower Back', 'Abs'),
    ('barbellsquat', 'Quads, Glutes', 'Hamstrings, Adductors, Lower Back, Abs'),
    ('barbellfrontsquat', 'Quads', 'Glutes, Adductors, Abs, Upper Back'),
    ('legpress', 'Quads, Glutes', 'Hamstrings, Adductors'),
    ('legextensionmachine', 'Quads', 'Hip Flexors'),
    ('seatedlegcurlmachine', 'Hamstrings', 'Calves'),
    ('standingcalfraisemachine', 'Calves', ''),
    ('donkeycalfraise', 'Calves', ''),
    ('barbellcalfraise', 'Calves', ''),
    ('barbellglutebridge', 'Glutes', 'Hamstrings, Quads'),
    ('glutehamraise', 'Hamstrings, Glutes', 'Lower Back, Calves'),
    ('lyinglegcurlmachine', 'Hamstrings', 'Calves'),
    ('romaniandeadlift', 'Hamstrings, Glutes', 'Lower Back, Forearms, Traps'),
    ('stiffleggeddeadlift', 'Hamstrings, Glutes, Lower Back', 'Forearms, Traps'),
    ('sumodeadlift', 'Glutes, Quads, Adductors', 'Hamstrings, Lower Back, Traps, Forearms'),
    ('seatedcalfraise', 'Calves', ''),
    ('abwheelrollout', 'Abs', 'Obliques, Lats, Hip Flexors'),
    ('cablecrunch', 'Abs', 'Obliques'),
    ('crunch', 'Abs', 'Obliques'),
    ('crunchmachine', 'Abs', 'Obliques'),
    ('declinecrunch', 'Abs', 'Obliques, Hip Flexors'),
    ('dragonflag', 'Abs', 'Obliques, Hip Flexors, Lats'),
    ('garhammer', 'Abs', 'Hip Flexors, Obliques'),
    ('hanginglegraise', 'Abs, Hip Flexors', 'Obliques, Forearms'),
    ('plank', 'Abs', 'Obliques, Lower Back'),
    ('sideplank', 'Obliques', 'Abs, Abductors'),
    ('cycling', 'Quads, Glutes', 'Hamstrings, Calves'),
    ('walking', 'Quads, Hamstrings, Calves', 'Glutes, Hip Flexors'),
    ('rowingmachine', 'Lats, Quads', 'Upper Back, Biceps, Hamstrings, Glutes'),
    ('stationarybike', 'Quads, Glutes', 'Hamstrings, Calves'),
    ('swimming', 'Lats, Chest', 'Triceps, Front Delts, Upper Back'),
    ('runningtreadmill', 'Quads, Hamstrings, Calves', 'Glutes, Hip Flexors'),
    ('runningoutdoor', 'Quads, Hamstrings, Calves', 'Glutes, Hip Flexors'),
    ('ellipticaltrainer', 'Quads, Glutes', 'Hamstrings, Calves')
)
UPDATE exercises e
SET primary_muscles = CASE
      WHEN e.primary_muscles IS NULL OR e.primary_muscles = '' THEN m.prim
      ELSE e.primary_muscles
    END,
    secondary_muscles = CASE
      WHEN e.secondary_muscles IS NULL OR e.secondary_muscles = '' THEN m.sec
      ELSE e.secondary_muscles
    END,
    last_modified = NOW()
FROM muscle_map m
WHERE lower(regexp_replace(e.name, '[^a-zA-Z0-9]+', '', 'g')) = m.name_norm
  AND (
    ((e.primary_muscles IS NULL OR e.primary_muscles = '') AND m.prim <> '')
    OR ((e.secondary_muscles IS NULL OR e.secondary_muscles = '') AND m.sec <> '')
  );