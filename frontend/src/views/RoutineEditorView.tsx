// RoutineEditorView.tsx - One routine: its days and what each day trains.
// Read mode is for starting a day; Edit mode (as in the original app's
// Edit/Done toggle) reveals reordering, naming, adding and removing. Set-level
// detail opens in a sheet so the day list stays scannable.
import { useMemo, useState } from 'react';
import {
  ChevronLeft, Plus, Trash2, GripVertical, Play, Copy, SlidersHorizontal,
  History as HistoryIcon, Link2, Unlink, Repeat, ChevronUp, ChevronDown,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useFitNotesStore } from '../store/FitNotesStore';
import { intColorToHex } from '../lib/colors';
import { typeHasDistance, typeHasDuration, typeHasReps, typeHasWeight, unitCodeFor, weightInUnit } from '../lib/units';
import { summarizePlan, nextDayId } from '../lib/routinePlan';
import { getLocalDateString } from '../lib/date';
import { formatTargetDate } from '../store/slices/useRoutinesSlice';
import { POPULATE_SETS_TYPE } from '../types';
import type { RoutineSection, RoutineSectionExercise, RoutineSectionExerciseSet } from '../types';
import { Sheet } from '../components/Sheet';
import { OverflowMenu } from '../components/OverflowMenu';

const bySortOrder = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

const FILL_OPTIONS = [
  { value: POPULATE_SETS_TYPE.PREDEFINED_SETS, label: 'Planned sets', hint: 'These sets are added each time. A blank field carries over from last time.' },
  { value: POPULATE_SETS_TYPE.COPY_PREVIOUS_WORKOUT, label: 'Repeat last time', hint: 'Copies whatever you logged for this exercise last session.' },
  { value: POPULATE_SETS_TYPE.NONE, label: 'Log as you go', hint: 'Adds one empty set; you record the rest during the workout.' },
];

const SET_TYPES: [string, string][] = [['working', 'Working'], ['warmup', 'Warm-up'], ['amrap', 'AMRAP'], ['failure', 'To failure'], ['drop', 'Drop set']];

// An empty field means "carry over from the previous workout".
const numOrNull = (raw: string, parse: (v: string) => number): number | null => {
  if (raw.trim() === '') return null;
  const parsed = parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
};

export function RoutineEditorView() {
  const {
    editingRoutine, setActiveTab, setEditingRoutine,
    routines, handleUpdateRoutineCategory, handleUpdateRoutineDetails, handleCreateRoutineVersion,
    handleCopyRoutine, handleDeleteRoutine,
    handleAddDayToRoutine, handleDragEnd, handleReorderRoutineSections, handleReorderRoutineSectionExercises,
    editorSections, editorSectionExercises, editorExerciseSets,
    exercises, groupExercises, workoutGroups, userUnit, workoutRoutines,
    handleUpdateSectionName, handleUpdateSectionSchedule, handleDeleteSection,
    handleUpdatePopulateSetsType, handleUpdateRoutineSectionExercise,
    openAddExerciseToSection, openSwitchRoutineSectionExercise, openPastImporter,
    selectedSectionExerciseIdsForSuperset, setSelectedSectionExerciseIdsForSuperset,
    handleClearRoutineGroup, handleUpdateRoutineGroupName, handleDeleteExerciseFromSection,
    handleUpdateTemplateSetValues, handleDeleteSetFromTemplateExercise, handleAddSetToTemplateExercise,
    supersetColor, setSupersetColor, supersetName, setSupersetName, isCreatingRoutineSuperset, handleCreateRoutineSuperset,
    setActiveSectionForPopulate, setPopulateTargetDate,
  } = useFitNotesStore();

  const [editing, setEditing] = useState(false);
  const [sheetExerciseId, setSheetExerciseId] = useState<string | null>(null);
  const [programOpen, setProgramOpen] = useState(false);

  const sections = useMemo(() => [...editorSections].filter(s => !s.is_deleted).sort(bySortOrder), [editorSections]);

  const lastDone = useMemo(() => {
    const bySection: Record<string, string> = {};
    const counts: Record<string, number> = {};
    for (const link of workoutRoutines) {
      if (link.is_deleted || !link.routine_section_id || link.routine_id !== editingRoutine?.id) continue;
      counts[link.routine_section_id] = (counts[link.routine_section_id] ?? 0) + 1;
      if (link.date > (bySection[link.routine_section_id] ?? '')) bySection[link.routine_section_id] = link.date;
    }
    return { bySection, counts };
  }, [workoutRoutines, editingRoutine?.id]);

  const upNext = useMemo(() => nextDayId(sections, lastDone.bySection), [sections, lastDone]);

  if (!editingRoutine) return null;

  const multiWeek = (editingRoutine.program_weeks ?? 1) > 1;
  const exercisesFor = (sectionId: string) => editorSectionExercises
    .filter(se => se.routine_section_id === sectionId && !se.is_deleted)
    .sort(bySortOrder);
  const setsFor = (rseId: string) => editorExerciseSets
    .filter(s => s.routine_section_exercise_id === rseId && !s.is_deleted)
    .sort(bySortOrder);
  const groupFor = (se: RoutineSectionExercise) => {
    const link = groupExercises.find(ge => ge.exercise_id === se.exercise_id && ge.routine_section_id === se.routine_section_id && !ge.is_deleted);
    return link ? workoutGroups.find(g => g.id === link.workout_group_id && !g.is_deleted) ?? null : null;
  };

  const startDay = (section: RoutineSection) => {
    setPopulateTargetDate(getLocalDateString());
    setActiveSectionForPopulate(section);
  };

  const moveDay = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= sections.length) return;
    const ids = sections.map(s => s.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void handleReorderRoutineSections(editingRoutine.id, ids);
  };

  const moveExercise = (sectionId: string, index: number, delta: number) => {
    const list = exercisesFor(sectionId);
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const ids = list.map(se => se.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void handleReorderRoutineSectionExercises(sectionId, ids);
  };

  const sheetLink = sheetExerciseId ? editorSectionExercises.find(se => se.id === sheetExerciseId && !se.is_deleted) ?? null : null;
  const sheetExercise = sheetLink ? exercises.find(ex => ex.id === sheetLink.exercise_id) ?? null : null;

  const goBack = () => {
    setActiveTab('routines');
    setEditingRoutine(null);
  };

  return (
    <div className={`routine-page${editing ? ' is-editing' : ''}`}>
      <header className="routine-head">
        <button type="button" className="btn btn-ghost back-btn" onClick={goBack}>
          <ChevronLeft size={18} aria-hidden /> Routines
        </button>
        <div className="routine-head-actions">
          <button type="button" className={`btn ${editing ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setEditing(v => !v); setSelectedSectionExerciseIdsForSuperset([]); }}>
            {editing ? 'Done' : 'Edit'}
          </button>
          <OverflowMenu
            label="Routine actions"
            items={[
              { label: 'Program settings', icon: <SlidersHorizontal size={16} aria-hidden />, onSelect: () => setProgramOpen(true) },
              { label: 'Duplicate routine', icon: <Copy size={16} aria-hidden />, onSelect: () => handleCopyRoutine(editingRoutine.id) },
              { label: 'Delete routine', icon: <Trash2 size={16} aria-hidden />, tone: 'danger', onSelect: () => handleDeleteRoutine(editingRoutine.id) },
            ]}
          />
        </div>
      </header>

      {editing ? (
        <div className="routine-identity is-editing">
          <input
            className="routine-name-input"
            type="text"
            aria-label="Routine name"
            defaultValue={editingRoutine.name}
            key={`${editingRoutine.id}-name-${editingRoutine.name}`}
            onBlur={(e) => {
              const next = e.target.value.trim();
              if (!next) { e.target.value = editingRoutine.name; return; }
              void handleUpdateRoutineDetails(editingRoutine.id, { name: next });
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          />
          <textarea
            className="routine-notes-input"
            aria-label="Routine notes"
            placeholder="Notes (optional)"
            defaultValue={editingRoutine.notes ?? ''}
            key={`${editingRoutine.id}-notes-${editingRoutine.notes ?? ''}`}
            onBlur={(e) => { void handleUpdateRoutineDetails(editingRoutine.id, { notes: e.target.value }); }}
            rows={2}
          />
        </div>
      ) : (
        <div className="routine-identity">
          <h1 className="page-title">{editingRoutine.name}</h1>
          <p className="routine-sub">
            {sections.length} day{sections.length === 1 ? '' : 's'}
            {editingRoutine.category ? ` · ${editingRoutine.category}` : ''}
            {multiWeek ? ` · week ${editingRoutine.current_week ?? 1} of ${editingRoutine.program_weeks}` : ''}
          </p>
          {editingRoutine.notes && <p className="routine-notes">{editingRoutine.notes}</p>}
        </div>
      )}

      {sections.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">No days yet</p>
          <p>A day is one workout: the exercises you do together, like “Push” or “Day A”.</p>
          <button type="button" className="btn btn-primary" onClick={() => { setEditing(true); void handleAddDayToRoutine(); }}>
            <Plus size={16} aria-hidden /> Add the first day
          </button>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="routine-days" type="SECTION" isDropDisabled={!editing}>
            {(provided) => (
              <div className="day-list" ref={provided.innerRef} {...provided.droppableProps}>
                {sections.map((section, sectionIndex) => {
                  const sectionExercises = exercisesFor(section.id);
                  const isNext = !editing && section.id === upNext;
                  const last = lastDone.bySection[section.id];
                  const selectedHere = selectedSectionExerciseIdsForSuperset.filter(id => sectionExercises.some(se => se.id === id));
                  return (
                    <Draggable key={section.id} draggableId={section.id} index={sectionIndex} isDragDisabled={!editing}>
                      {(dragSection) => (
                        <section
                          ref={dragSection.innerRef}
                          {...dragSection.draggableProps}
                          className={`day-card${isNext ? ' is-next' : ''}`}
                          aria-labelledby={`day-${section.id}`}
                        >
                          <header className="day-head">
                            {editing && (
                              <span className="drag-handle" {...dragSection.dragHandleProps} aria-label={`Reorder ${section.name}`}>
                                <GripVertical size={18} aria-hidden />
                              </span>
                            )}
                            <div className="day-head-text">
                              {editing ? (
                                <input
                                  id={`day-${section.id}`}
                                  className="day-name-input"
                                  aria-label={`Day ${sectionIndex + 1} name`}
                                  value={section.name}
                                  onChange={(e) => handleUpdateSectionName(section.id, e.target.value)}
                                />
                              ) : (
                                <h2 id={`day-${section.id}`} className="day-name">
                                  <span className="day-seq" aria-label={`Day ${sectionIndex + 1}:`}>{sectionIndex + 1}</span>
                                  {section.name}
                                </h2>
                              )}
                              {!editing && (
                                <span className="day-meta">
                                  {sectionExercises.length} exercise{sectionExercises.length === 1 ? '' : 's'}
                                  {last ? ` · last ${formatTargetDate(last)}` : ' · not done yet'}
                                  {lastDone.counts[section.id] ? ` · ${lastDone.counts[section.id]}×` : ''}
                                </span>
                              )}
                            </div>
                            {editing ? (
                              <div className="day-edit-actions">
                                <button type="button" className="icon-btn" onClick={() => moveDay(sectionIndex, -1)} disabled={sectionIndex === 0} aria-label={`Move ${section.name} up`}>
                                  <ChevronUp size={18} aria-hidden />
                                </button>
                                <button type="button" className="icon-btn" onClick={() => moveDay(sectionIndex, 1)} disabled={sectionIndex === sections.length - 1} aria-label={`Move ${section.name} down`}>
                                  <ChevronDown size={18} aria-hidden />
                                </button>
                                <OverflowMenu
                                  label={`${section.name} actions`}
                                  items={[
                                    { label: 'Add from a past workout', icon: <HistoryIcon size={16} aria-hidden />, onSelect: () => openPastImporter(section.id) },
                                    { label: 'Delete day', icon: <Trash2 size={16} aria-hidden />, tone: 'danger', onSelect: () => handleDeleteSection(section.id) },
                                  ]}
                                />
                              </div>
                            ) : (
                              <div className="day-start-group">
                                {isNext && <span className="next-tag">Up next</span>}
                                <button type="button" className={`btn ${isNext ? 'btn-primary' : 'btn-secondary'} day-start`} onClick={() => startDay(section)}>
                                  <Play size={16} aria-hidden /> Start
                                </button>
                              </div>
                            )}
                          </header>

                          {editing && multiWeek && (
                            <div className="day-schedule">
                              <label className="field">
                                <span className="field-label">Week</span>
                                <select value={section.week_number ?? 1} onChange={(e) => handleUpdateSectionSchedule(section.id, { week_number: Number(e.target.value) })}>
                                  {Array.from({ length: editingRoutine.program_weeks ?? 1 }, (_, i) => <option key={i + 1} value={i + 1}>Week {i + 1}</option>)}
                                </select>
                              </label>
                              <label className="field">
                                <span className="field-label">Weekday</span>
                                <select value={section.day_of_week ?? ''} onChange={(e) => handleUpdateSectionSchedule(section.id, { day_of_week: e.target.value ? Number(e.target.value) : null })}>
                                  <option value="">Any</option>
                                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
                                </select>
                              </label>
                              <label className="field">
                                <span className="field-label">Phase</span>
                                <input value={section.phase ?? ''} placeholder="e.g. Deload" onChange={(e) => handleUpdateSectionSchedule(section.id, { phase: e.target.value || null })} />
                              </label>
                            </div>
                          )}

                          <Droppable droppableId={`routine-section-exercises-${section.id}`} type="EXERCISE" isDropDisabled={!editing}>
                            {(dropEx) => (
                              <ol className="day-exercises" ref={dropEx.innerRef} {...dropEx.droppableProps}>
                                {sectionExercises.length === 0 && (
                                  <li className="day-empty">No exercises yet.</li>
                                )}
                                {sectionExercises.map((se, index) => {
                                  const ex = exercises.find(x => x.id === se.exercise_id);
                                  if (!ex) return null;
                                  const group = groupFor(se);
                                  const plan = summarizePlan(se, setsFor(se.id), ex.exercise_type_id, userUnit);
                                  const selected = selectedSectionExerciseIdsForSuperset.includes(se.id);
                                  return (
                                    <Draggable key={se.id} draggableId={se.id} index={index} isDragDisabled={!editing}>
                                      {(dragEx) => (
                                        <li
                                          ref={dragEx.innerRef}
                                          {...dragEx.draggableProps}
                                          className={`day-exercise${group ? ' in-superset' : ''}`}
                                          style={{ ...dragEx.draggableProps.style, ...(group ? { ['--superset' as string]: intColorToHex(group.colour) } : {}) }}
                                        >
                                          {editing && (
                                            <input
                                              type="checkbox"
                                              className="row-check"
                                              aria-label={`Select ${ex.name} for a superset`}
                                              checked={selected}
                                              onChange={(e) => setSelectedSectionExerciseIdsForSuperset(e.target.checked
                                                ? [...selectedSectionExerciseIdsForSuperset, se.id]
                                                : selectedSectionExerciseIdsForSuperset.filter(id => id !== se.id))}
                                            />
                                          )}
                                          <button type="button" className="day-exercise-main" onClick={() => setSheetExerciseId(se.id)}>
                                            <span className="day-exercise-name">{ex.name}</span>
                                            <span className="day-exercise-plan">
                                              {group && <span className="superset-tag">{group.name || 'Superset'}</span>}
                                              {plan}
                                            </span>
                                          </button>
                                          {editing && (
                                            <span className="day-exercise-reorder">
                                              <button type="button" className="icon-btn" onClick={() => moveExercise(section.id, index, -1)} disabled={index === 0} aria-label={`Move ${ex.name} up`}>
                                                <ChevronUp size={16} aria-hidden />
                                              </button>
                                              <button type="button" className="icon-btn" onClick={() => moveExercise(section.id, index, 1)} disabled={index === sectionExercises.length - 1} aria-label={`Move ${ex.name} down`}>
                                                <ChevronDown size={16} aria-hidden />
                                              </button>
                                              <span className="drag-handle" {...dragEx.dragHandleProps} aria-label={`Drag ${ex.name}`}>
                                                <GripVertical size={16} aria-hidden />
                                              </span>
                                            </span>
                                          )}
                                        </li>
                                      )}
                                    </Draggable>
                                  );
                                })}
                                {dropEx.placeholder}
                              </ol>
                            )}
                          </Droppable>

                          {editing && selectedHere.length >= 2 && (
                            <div className="superset-bar" role="group" aria-label="Link selected exercises">
                              <span className="superset-bar-count">{selectedHere.length} selected</span>
                              <input type="text" value={supersetName} onChange={e => setSupersetName(e.target.value)} aria-label="Superset name" placeholder="Superset name" />
                              <input type="color" value={supersetColor} onChange={e => setSupersetColor(e.target.value)} aria-label="Superset colour" />
                              <button
                                type="button"
                                className="btn btn-primary"
                                disabled={isCreatingRoutineSuperset}
                                onClick={async () => {
                                  const created = await handleCreateRoutineSuperset(section.id, selectedHere, supersetName);
                                  if (created) {
                                    setSupersetName('Superset');
                                    setSelectedSectionExerciseIdsForSuperset([]);
                                  }
                                }}
                              >
                                <Link2 size={16} aria-hidden /> {isCreatingRoutineSuperset ? 'Linking…' : 'Link as superset'}
                              </button>
                            </div>
                          )}

                          {editing && (
                            <button type="button" className="btn btn-ghost add-row" onClick={() => openAddExerciseToSection(section.id)}>
                              <Plus size={16} aria-hidden /> Add exercise
                            </button>
                          )}
                        </section>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {editing && sections.length > 0 && (
        <button type="button" className="btn btn-secondary add-day" onClick={() => void handleAddDayToRoutine()}>
          <Plus size={16} aria-hidden /> Add day
        </button>
      )}

      {/* Exercise detail: how this exercise's sets are filled, and the plan itself. */}
      <Sheet
        open={!!sheetLink && !!sheetExercise}
        onClose={() => setSheetExerciseId(null)}
        title={sheetExercise?.name ?? ''}
        subtitle={sheetLink ? sections.find(s => s.id === sheetLink.routine_section_id)?.name : undefined}
        labelledBy="routine-exercise-sheet"
      >
        {sheetLink && sheetExercise && (
          <ExercisePlanEditor
            link={sheetLink}
            sets={setsFor(sheetLink.id)}
            typeId={sheetExercise.exercise_type_id}
            userUnit={userUnit}
            group={groupFor(sheetLink)}
            onFill={(value) => handleUpdatePopulateSetsType(sheetLink.id, value)}
            onSet={(setId, values) => handleUpdateTemplateSetValues(setId, values)}
            onAddSet={() => handleAddSetToTemplateExercise(sheetLink.id)}
            onDeleteSet={(setId) => handleDeleteSetFromTemplateExercise(setId)}
            onProgression={(values) => handleUpdateRoutineSectionExercise(sheetLink.id, values)}
            onRenameGroup={(groupId, name) => handleUpdateRoutineGroupName(groupId, name)}
            onUnlink={(groupId) => handleClearRoutineGroup(groupId)}
            onSwitch={() => { setSheetExerciseId(null); openSwitchRoutineSectionExercise(sheetLink.id); }}
            onRemove={() => { setSheetExerciseId(null); void handleDeleteExerciseFromSection(sheetLink.id); }}
          />
        )}
      </Sheet>

      {/* Program settings: optional periodisation, kept out of the day list. */}
      <Sheet open={programOpen} onClose={() => setProgramOpen(false)} title="Program settings" labelledBy="program-settings-sheet">
        <div className="form-stack">
          <label className="field">
            <span className="field-label">Category</span>
            <input
              type="text"
              list="routine-category-options"
              placeholder="e.g. Strength"
              defaultValue={editingRoutine.category ?? ''}
              key={`${editingRoutine.id}-category`}
              onBlur={(e) => handleUpdateRoutineCategory(editingRoutine.id, e.target.value)}
            />
            <datalist id="routine-category-options">
              {Array.from(new Set(routines.map(r => (r.category ?? '').trim()).filter(Boolean))).sort().map(c => <option key={c} value={c} />)}
            </datalist>
          </label>
          <div className="field-row">
            <label className="field">
              <span className="field-label">Program length (weeks)</span>
              <input type="number" min="1" max="52" value={editingRoutine.program_weeks ?? 1} onChange={(e) => handleUpdateRoutineDetails(editingRoutine.id, { program_weeks: Math.max(1, Number(e.target.value)) })} />
            </label>
            <label className="field">
              <span className="field-label">Current week</span>
              <input type="number" min="1" max={editingRoutine.program_weeks ?? 1} value={editingRoutine.current_week ?? 1} onChange={(e) => handleUpdateRoutineDetails(editingRoutine.id, { current_week: Math.max(1, Number(e.target.value)) })} />
            </label>
          </div>
          <label className="field">
            <span className="field-label">Start date</span>
            <input type="date" value={editingRoutine.start_date ?? ''} onChange={(e) => handleUpdateRoutineDetails(editingRoutine.id, { start_date: e.target.value || null })} />
          </label>
          <p className="field-hint">With more than one week, each day can be assigned to a week, and starting the routine loads the current week’s days.</p>
          <div className="field-row is-split">
            <span className="field-label">Version {editingRoutine.version ?? 1}</span>
            <button type="button" className="btn btn-secondary" onClick={() => { setProgramOpen(false); void handleCreateRoutineVersion(editingRoutine.id); }}>
              <Repeat size={16} aria-hidden /> Save as new version
            </button>
          </div>
          <label className="check-field">
            <input type="checkbox" checked={editingRoutine.is_archived ?? false} onChange={(e) => handleUpdateRoutineDetails(editingRoutine.id, { is_archived: e.target.checked })} />
            <span>Archived (hidden from the routine list)</span>
          </label>
        </div>
      </Sheet>
    </div>
  );
}

interface PlanEditorProps {
  link: RoutineSectionExercise;
  sets: RoutineSectionExerciseSet[];
  typeId: number;
  userUnit: 'kg' | 'lbs';
  group: { id: string; name: string; colour: number } | null;
  onFill: (value: number) => void;
  onSet: (setId: string, values: Partial<RoutineSectionExerciseSet>) => void;
  onAddSet: () => void;
  onDeleteSet: (setId: string) => void;
  onProgression: (values: Partial<RoutineSectionExercise>) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onUnlink: (groupId: string) => void;
  onSwitch: () => void;
  onRemove: () => void;
}

function ExercisePlanEditor({
  link, sets, typeId, userUnit, group, onFill, onSet, onAddSet, onDeleteSet,
  onProgression, onRenameGroup, onUnlink, onSwitch, onRemove,
}: PlanEditorProps) {
  const fill = link.populate_sets_type ?? POPULATE_SETS_TYPE.PREDEFINED_SETS;
  const step = userUnit === 'kg' ? 2.5 : 5;
  const unitLabel = userUnit === 'kg' ? 'kg' : 'lb';
  const shown = (set: RoutineSectionExerciseSet) => weightInUnit(set.metric_weight ?? 0, set.unit, userUnit);
  const hasWeight = typeHasWeight(typeId);
  const hasReps = typeHasReps(typeId);

  return (
    <div className="form-stack">
      <fieldset className="segmented">
        <legend className="field-label">Each workout starts with</legend>
        {FILL_OPTIONS.map(option => (
          <label key={option.value} className={`segmented-option${fill === option.value ? ' is-selected' : ''}`}>
            <input type="radio" name={`fill-${link.id}`} checked={fill === option.value} onChange={() => onFill(option.value)} />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
      <p className="field-hint">{FILL_OPTIONS.find(o => o.value === fill)?.hint}</p>

      {fill === POPULATE_SETS_TYPE.PREDEFINED_SETS && (
        <div className="plan-sets">
          {sets.length === 0 && <p className="field-hint">No sets planned yet.</p>}
          {sets.map((set, index) => (
            <div key={set.id} className="plan-set">
              <span className="plan-set-num">Set {index + 1}</span>
              {hasWeight && (
                <div className="stepper" role="group" aria-label={`Set ${index + 1} weight`}>
                  <button type="button" onClick={() => onSet(set.id, { metric_weight: Math.max(0, shown(set) - step), unit: unitCodeFor(userUnit) })} aria-label="Less weight">−</button>
                  <input
                    type="number"
                    inputMode="decimal"
                    placeholder="last"
                    value={set.metric_weight == null ? '' : shown(set)}
                    onChange={(e) => onSet(set.id, { metric_weight: numOrNull(e.target.value, parseFloat), unit: unitCodeFor(userUnit) })}
                    aria-label={`Weight in ${unitLabel}`}
                  />
                  <span className="stepper-unit">{unitLabel}</span>
                  <button type="button" onClick={() => onSet(set.id, { metric_weight: shown(set) + step, unit: unitCodeFor(userUnit) })} aria-label="More weight">+</button>
                </div>
              )}
              {hasReps && (
                <div className="stepper" role="group" aria-label={`Set ${index + 1} reps`}>
                  <button type="button" onClick={() => onSet(set.id, { reps: Math.max(0, (set.reps || 0) - 1) })} aria-label="Fewer reps">−</button>
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="last"
                    value={set.reps ?? ''}
                    onChange={(e) => onSet(set.id, { reps: numOrNull(e.target.value, v => parseInt(v, 10)) })}
                    aria-label="Reps"
                  />
                  <span className="stepper-unit">reps</span>
                  <button type="button" onClick={() => onSet(set.id, { reps: (set.reps || 0) + 1 })} aria-label="More reps">+</button>
                </div>
              )}
              {typeHasDuration(typeId) && (
                <label className="field is-inline">
                  <span className="field-label">Seconds</span>
                  <input type="number" inputMode="numeric" placeholder="last" value={set.duration_seconds ?? ''} onChange={(e) => onSet(set.id, { duration_seconds: numOrNull(e.target.value, v => parseInt(v, 10)) })} />
                </label>
              )}
              {typeHasDistance(typeId) && (
                <label className="field is-inline">
                  <span className="field-label">Distance</span>
                  <input type="number" inputMode="decimal" placeholder="last" value={set.distance ?? ''} onChange={(e) => onSet(set.id, { distance: numOrNull(e.target.value, parseFloat) })} />
                </label>
              )}
              <button type="button" className="icon-btn is-danger" onClick={() => onDeleteSet(set.id)} aria-label={`Delete set ${index + 1}`}>
                <Trash2 size={16} aria-hidden />
              </button>

              <details className="plan-set-advanced">
                <summary>Targets & notes</summary>
                <div className="field-row">
                  {hasReps && <>
                    <label className="field"><span className="field-label">Min reps</span>
                      <input type="number" min="0" value={set.min_reps ?? ''} onChange={(e) => onSet(set.id, { min_reps: numOrNull(e.target.value, v => parseInt(v, 10)) })} />
                    </label>
                    <label className="field"><span className="field-label">Max reps</span>
                      <input type="number" min="0" value={set.max_reps ?? ''} onChange={(e) => onSet(set.id, { max_reps: numOrNull(e.target.value, v => parseInt(v, 10)) })} />
                    </label>
                  </>}
                  <label className="field"><span className="field-label">Type</span>
                    <select value={set.set_type ?? 'working'} onChange={(e) => onSet(set.id, { set_type: e.target.value })}>
                      {SET_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </label>
                  <label className="field"><span className="field-label">Target RIR</span>
                    <input type="number" min="0" max="10" step="0.5" value={set.target_rir ?? ''} onChange={(e) => onSet(set.id, { target_rir: numOrNull(e.target.value, parseFloat) })} />
                  </label>
                  <label className="field"><span className="field-label">Tempo</span>
                    <input placeholder="3-1-1" value={set.tempo ?? ''} onChange={(e) => onSet(set.id, { tempo: e.target.value || null })} />
                  </label>
                </div>
                <label className="field"><span className="field-label">Note for this set</span>
                  <input value={set.notes ?? ''} onChange={(e) => onSet(set.id, { notes: e.target.value || null })} />
                </label>
              </details>
            </div>
          ))}
          <button type="button" className="btn btn-ghost add-row" onClick={onAddSet}>
            <Plus size={16} aria-hidden /> Add set
          </button>
        </div>
      )}

      <details className="plan-advanced">
        <summary>Auto-progression</summary>
        <label className="check-field">
          <input type="checkbox" checked={link.progression_enabled ?? false} onChange={(e) => onProgression({ progression_enabled: e.target.checked })} />
          <span>Increase the plan after a session where every target was hit</span>
        </label>
        {!!link.progression_enabled && (
          <div className="field-row">
            <label className="field"><span className="field-label">Add weight ({unitLabel})</span>
              <input type="number" step="0.5" placeholder="exercise default" value={link.progression_increment ?? ''} onChange={(e) => onProgression({ progression_increment: numOrNull(e.target.value, parseFloat) })} />
            </label>
            <label className="field"><span className="field-label">Or add reps</span>
              <input type="number" min="1" value={link.progression_reps_step ?? 1} onChange={(e) => onProgression({ progression_reps_step: Math.max(1, Number(e.target.value)) })} />
            </label>
          </div>
        )}
      </details>

      {group && (
        <div className="field-row is-split">
          <label className="field">
            <span className="field-label">Superset</span>
            <input defaultValue={group.name} key={`${group.id}-${group.name}`} onBlur={(e) => onRenameGroup(group.id, e.target.value)} />
          </label>
          <button type="button" className="btn btn-secondary" onClick={() => onUnlink(group.id)}>
            <Unlink size={16} aria-hidden /> Unlink
          </button>
        </div>
      )}

      <div className="sheet-actions">
        <button type="button" className="btn btn-secondary" onClick={onSwitch}>Swap exercise</button>
        <button type="button" className="btn btn-danger-ghost" onClick={onRemove}>
          <Trash2 size={16} aria-hidden /> Remove from day
        </button>
      </div>
    </div>
  );
}
