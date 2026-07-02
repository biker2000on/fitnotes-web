// RoutineEditorView.tsx - Edit a routine template: workout days (sections),
// exercises within days, predefined sets, drag-to-reorder, and superset linking.
import { ChevronLeft, Plus, Check, Bookmark, Trash2, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useFitNotesStore } from '../store/FitNotesStore';
import { intColorToHex } from '../lib/colors';
import { typeHasDistance, typeHasDuration, typeHasReps, typeHasWeight } from '../lib/units';
import { POPULATE_SETS_TYPE } from '../types';

const bySortOrder = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

// The three set-population modes from the reference app, in its display order.
const POPULATE_TYPE_OPTIONS = [
  {
    value: POPULATE_SETS_TYPE.COPY_PREVIOUS_WORKOUT,
    label: 'Copy previous sets',
    hint: "Automatically copies sets from this exercise's most recent workout.",
  },
  {
    value: POPULATE_SETS_TYPE.PREDEFINED_SETS,
    label: 'Predefined sets',
    hint: 'Sets below are created in each workout. Leave a field blank to carry that value over from the previous workout.',
  },
  {
    value: POPULATE_SETS_TYPE.NONE,
    label: "Don't populate",
    hint: 'No sets are pre-filled — record sets on-the-fly during the workout.',
  },
];

// Parse a numeric input where an empty field means "inherit from previous workout".
const numOrNull = (raw: string, parse: (v: string) => number): number | null => {
  if (raw.trim() === '') return null;
  const parsed = parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
};

export function RoutineEditorView() {
  const {
    editingRoutine, setActiveTab, setEditingRoutine,
    handleAddDayToRoutine, handleDragEnd,
    editorSections, editorSectionExercises, editorExerciseSets,
    exercises, groupExercises, workoutGroups, userUnit,
    handleUpdateSectionName, handleAddAllSectionLogs, handleDeleteSection,
    handleUpdatePopulateSetsType,
    openAddExerciseToSection, openPastImporter,
    selectedSectionExerciseIdsForSuperset, setSelectedSectionExerciseIdsForSuperset,
    handleClearRoutineGroup, handleDeleteExerciseFromSection,
    handleUpdateTemplateSetValues, handleDeleteSetFromTemplateExercise, handleAddSetToTemplateExercise,
    supersetColor, setSupersetColor, handleCreateRoutineSuperset,
  } = useFitNotesStore();

  if (!editingRoutine) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn btn-secondary" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => {
              setActiveTab('routines');
              setEditingRoutine(null);
            }}>
              <ChevronLeft size={16} /> Back
            </button>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary-dark)', margin: 0 }}>
                Editing: {editingRoutine.name}
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', marginTop: '2px', margin: 0 }}>
                {editingRoutine.notes || 'Manage days, exercises, and sets for this template.'}
              </p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={handleAddDayToRoutine} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> Add Workout Day
          </button>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="routine-days" type="SECTION">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
              {editorSections.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <p style={{ color: 'var(--text-secondary-dark)', fontSize: '14px', margin: 0 }}>
                    No workout days added to this template yet. Click 'Add Workout Day' to start.
                  </p>
                </div>
              ) : (
                editorSections.map((section, sectionIndex) => {
                  const sectionExercises = editorSectionExercises.filter(se => se.routine_section_id === section.id).sort(bySortOrder);

                  return (
                    <Draggable key={section.id} draggableId={section.id} index={sectionIndex}>
                      {(providedSection) => (
                        <div
                          ref={providedSection.innerRef}
                          {...providedSection.draggableProps}
                          className="card"
                          style={{ padding: '24px', backgroundColor: 'var(--bg-surface-dark)', border: '1px solid var(--border-dark)', borderRadius: '16px', ...providedSection.draggableProps.style }}
                        >
                          {/* Section Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-dark)', paddingBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 200px', minWidth: 0 }}>
                              <div {...providedSection.dragHandleProps} style={{ cursor: 'grab', color: 'var(--text-secondary-dark)', display: 'flex', alignItems: 'center' }}>
                                <GripVertical size={18} />
                              </div>
                              <input
                                type="text"
                                value={section.name}
                                onChange={(e) => handleUpdateSectionName(section.id, e.target.value)}
                                style={{ fontWeight: 800, fontSize: '16px', border: 'none', background: 'transparent', padding: '4px', borderBottom: '1px solid transparent', flex: 1, minWidth: '120px', maxWidth: '280px', color: 'var(--text-primary-dark)' }}
                                onFocus={(e) => (e.target.style.borderBottomColor = 'var(--primary)')}
                                onBlur={(e) => (e.target.style.borderBottomColor = 'transparent')}
                              />
                            </div>

                            <div className="routine-section-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                              <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleAddAllSectionLogs(section.id)} title="Log all template sets from this day into today's log">
                                <Check size={14} color="var(--success)" /> Add to Log
                              </button>
                              <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => openAddExerciseToSection(section.id)}>
                                <Plus size={14} /> Add Exercise
                              </button>
                              <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => openPastImporter(section.id)}>
                                <Bookmark size={14} color="var(--primary)" /> Import Past
                              </button>
                              <button className="btn btn-secondary" style={{ padding: '6px', backgroundColor: 'transparent', border: 'none', color: 'var(--danger)', display: 'flex', alignItems: 'center' }} onClick={() => handleDeleteSection(section.id)} title="Delete Workout Day">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {/* Exercises Droppable Area inside this section */}
                          <Droppable droppableId={`routine-section-exercises-${section.id}`} type="EXERCISE">
                            {(providedEx) => (
                              <div ref={providedEx.innerRef} {...providedEx.droppableProps} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px', minHeight: '30px' }}>
                                {sectionExercises.length === 0 ? (
                                  <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', textAlign: 'center', fontStyle: 'italic', padding: '16px 0', margin: 0 }}>
                                    No exercises added to this day yet.
                                  </p>
                                ) : (
                                  sectionExercises.map((se, index) => {
                                    const ex = exercises.find(x => x.id === se.exercise_id);
                                    if (!ex) return null;

                                    const linkedGroupEx = groupExercises.find(ge => ge.exercise_id === se.exercise_id && ge.routine_section_id === section.id && !ge.is_deleted);
                                    const group = linkedGroupEx ? workoutGroups.find(g => g.id === linkedGroupEx.workout_group_id && !g.is_deleted) : null;
                                    const groupColor = group ? intColorToHex(group.colour) : null;

                                    const exerciseSets = editorExerciseSets.filter(s => s.routine_section_exercise_id === se.id).sort(bySortOrder);

                                    return (
                                      <Draggable key={se.id} draggableId={se.id} index={index}>
                                        {(providedExDraggable) => (
                                          <div
                                            ref={providedExDraggable.innerRef}
                                            {...providedExDraggable.draggableProps}
                                            style={{ backgroundColor: 'rgba(255, 255, 255, 0.015)', border: '1px solid var(--border-dark)', borderLeft: groupColor ? `6px solid ${groupColor}` : '1px solid var(--border-dark)', borderRadius: groupColor ? '0 12px 12px 0' : '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', ...providedExDraggable.draggableProps.style }}
                                          >
                                            {/* Exercise Header */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                <input
                                                  type="checkbox"
                                                  className="set-select-checkbox"
                                                  checked={selectedSectionExerciseIdsForSuperset.includes(se.id)}
                                                  onChange={(e) => {
                                                    if (e.target.checked) {
                                                      setSelectedSectionExerciseIdsForSuperset([...selectedSectionExerciseIdsForSuperset, se.id]);
                                                    } else {
                                                      setSelectedSectionExerciseIdsForSuperset(selectedSectionExerciseIdsForSuperset.filter(id => id !== se.id));
                                                    }
                                                  }}
                                                />
                                                <div {...providedExDraggable.dragHandleProps} style={{ cursor: 'grab', color: 'var(--text-secondary-dark)', display: 'flex', alignItems: 'center' }}>
                                                  <GripVertical size={16} />
                                                </div>
                                                <div>
                                                  <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary-dark)' }}>{ex.name}</span>
                                                  {group && (
                                                    <span style={{ marginLeft: '8px', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', backgroundColor: groupColor ? groupColor + '20' : undefined, color: groupColor || undefined, fontWeight: 700, textTransform: 'uppercase' }}>
                                                      Superset
                                                    </span>
                                                  )}
                                                </div>
                                              </div>

                                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                {group && (
                                                  <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '10px', color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => handleClearRoutineGroup(group.id)}>
                                                    Unlink Superset
                                                  </button>
                                                )}
                                                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => handleDeleteExerciseFromSection(se.id)}>
                                                  <Trash2 size={12} /> Delete
                                                </button>
                                              </div>
                                            </div>

                                            {/* Set population mode (mirrors reference populate_sets_type dialog) */}
                                            <div className="populate-type-row">
                                              {POPULATE_TYPE_OPTIONS.map(opt => (
                                                <button
                                                  key={opt.value}
                                                  className={`populate-type-btn ${se.populate_sets_type === opt.value ? 'active' : ''}`}
                                                  onClick={() => handleUpdatePopulateSetsType(se.id, opt.value)}
                                                >
                                                  {opt.label}
                                                </button>
                                              ))}
                                            </div>
                                            <p className="populate-type-hint">
                                              {(POPULATE_TYPE_OPTIONS.find(opt => opt.value === se.populate_sets_type) ?? POPULATE_TYPE_OPTIONS[1]).hint}
                                            </p>

                                            {/* Template Predefined Sets List (only relevant for predefined mode) */}
                                            {se.populate_sets_type === POPULATE_SETS_TYPE.PREDEFINED_SETS && (
                                            <div style={{ paddingLeft: '8px' }}>
                                              {exerciseSets.length === 0 ? (
                                                <p style={{ fontSize: '12px', color: 'var(--text-secondary-dark)', fontStyle: 'italic', margin: '4px 0 10px 0' }}>No predefined sets added yet.</p>
                                              ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '10px' }}>
                                                  {exerciseSets.map((set, setIdx) => {
                                                    const isWeightedEx = typeHasWeight(ex.exercise_type_id);
                                                    const hasReps = typeHasReps(ex.exercise_type_id);
                                                    const hasDistance = typeHasDistance(ex.exercise_type_id);
                                                    const hasDuration = typeHasDuration(ex.exercise_type_id);

                                                    return (
                                                      <div key={set.id} className="template-set-row">
                                                        <span style={{ fontWeight: 800, color: 'var(--text-secondary-dark)', width: '40px', flexShrink: 0 }}>Set {setIdx + 1}</span>

                                                        {isWeightedEx && (
                                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ color: 'var(--text-secondary-dark)' }}>Weight:</span>
                                                            <button className="btn btn-secondary template-set-stepper" onClick={() => handleUpdateTemplateSetValues(set.id, { metric_weight: Math.max(0, (set.metric_weight || 0) - 2.5) })}>-</button>
                                                            <input type="number" placeholder="prev" value={set.metric_weight ?? ''} onChange={(e) => handleUpdateTemplateSetValues(set.id, { metric_weight: numOrNull(e.target.value, parseFloat) })} style={{ width: '65px', padding: '4px', textAlign: 'center', fontSize: '13px', height: '28px', borderRadius: '4px' }} />
                                                            <button className="btn btn-secondary template-set-stepper" onClick={() => handleUpdateTemplateSetValues(set.id, { metric_weight: (set.metric_weight || 0) + 2.5 })}>+</button>
                                                            <span style={{ color: 'var(--text-secondary-dark)', fontSize: '12px' }}>{userUnit}</span>
                                                          </div>
                                                        )}

                                                        {hasReps && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                          <span style={{ color: 'var(--text-secondary-dark)' }}>Reps:</span>
                                                          <button className="btn btn-secondary template-set-stepper" onClick={() => handleUpdateTemplateSetValues(set.id, { reps: Math.max(0, (set.reps || 0) - 1) })}>-</button>
                                                          <input type="number" placeholder="prev" value={set.reps ?? ''} onChange={(e) => handleUpdateTemplateSetValues(set.id, { reps: numOrNull(e.target.value, (v) => parseInt(v, 10)) })} style={{ width: '50px', padding: '4px', textAlign: 'center', fontSize: '13px', height: '28px', borderRadius: '4px' }} />
                                                          <button className="btn btn-secondary template-set-stepper" onClick={() => handleUpdateTemplateSetValues(set.id, { reps: (set.reps || 0) + 1 })}>+</button>
                                                        </div>
                                                        )}

                                                        {hasDistance && (
                                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ color: 'var(--text-secondary-dark)' }}>Distance:</span>
                                                            <input type="number" placeholder="prev" value={set.distance ?? ''} onChange={(e) => handleUpdateTemplateSetValues(set.id, { distance: numOrNull(e.target.value, parseFloat) })} style={{ width: '65px', padding: '4px', textAlign: 'center', fontSize: '13px', height: '28px', borderRadius: '4px' }} />
                                                          </div>
                                                        )}

                                                        {hasDuration && (
                                                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <span style={{ color: 'var(--text-secondary-dark)' }}>Time:</span>
                                                            <input type="number" placeholder="prev" value={set.duration_seconds ?? ''} onChange={(e) => handleUpdateTemplateSetValues(set.id, { duration_seconds: numOrNull(e.target.value, (v) => parseInt(v, 10)) })} style={{ width: '65px', padding: '4px', textAlign: 'center', fontSize: '13px', height: '28px', borderRadius: '4px' }} />
                                                            <span style={{ color: 'var(--text-secondary-dark)', fontSize: '12px' }}>sec</span>
                                                          </div>
                                                        )}

                                                        <button style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary-dark)', cursor: 'pointer', marginLeft: 'auto', display: 'flex', alignItems: 'center', padding: '6px' }} onClick={() => handleDeleteSetFromTemplateExercise(set.id)} title="Delete Set">
                                                          <Trash2 size={14} color="var(--danger)" />
                                                        </button>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              )}

                                              <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={() => handleAddSetToTemplateExercise(se.id)}>
                                                <Plus size={12} /> Add Predefined Set
                                              </button>
                                            </div>
                                            )}
                                          </div>
                                        )}
                                      </Draggable>
                                    );
                                  })
                                )}
                                {providedEx.placeholder}
                              </div>
                            )}
                          </Droppable>

                          {/* Floating Action Bar for Selected Day exercises for Superset Grouping */}
                          {selectedSectionExerciseIdsForSuperset.filter(id => sectionExercises.some(se => se.id === id)).length >= 2 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(2, 132, 199, 0.08)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(2, 132, 199, 0.2)', marginTop: '16px', flexWrap: 'wrap', gap: '12px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
                                {selectedSectionExerciseIdsForSuperset.filter(id => sectionExercises.some(se => se.id === id)).length} exercises selected
                              </span>
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)' }}>Superset Bracket Color:</span>
                                <input type="color" value={supersetColor} onChange={e => setSupersetColor(e.target.value)} style={{ width: '32px', height: '28px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: 'transparent' }} />
                                <button
                                  className="btn btn-primary"
                                  style={{ padding: '6px 12px', fontSize: '12px' }}
                                  onClick={() => {
                                    const selectedIds = selectedSectionExerciseIdsForSuperset.filter(id => sectionExercises.some(se => se.id === id));
                                    const actualExIds = selectedIds.map(id => sectionExercises.find(se => se.id === id)!.exercise_id);
                                    handleCreateRoutineSuperset(section.id, actualExIds);
                                    setSelectedSectionExerciseIdsForSuperset([]);
                                  }}
                                >
                                  Link as Superset
                                </button>
                                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => setSelectedSectionExerciseIdsForSuperset([])}>
                                  Clear
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Draggable>
                  );
                })
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
