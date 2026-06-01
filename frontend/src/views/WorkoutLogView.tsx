// WorkoutLogView.tsx - The core date-based workout logger: set entry, logged
// sets table (drag to reorder), today's summary with supersets, comments, and
// the plate-loading visualizer.
import {
  TrendingUp, Calculator, Plus, Check, Trash2, GripVertical,
  Dumbbell, Layers, Bookmark, FileText, Timer, Share2,
} from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useFitNotesStore } from '../store/FitNotesStore';
import { intColorToHex } from '../lib/colors';
import { typeHasDistance, typeHasDuration, typeHasReps, typeHasWeight } from '../lib/units';

export function WorkoutLogView() {
  const {
    selectedExercise, setSelectedExercise, userUnit,
    logWeight, setLogWeight, logReps, setLogReps, logDistance, setLogDistance, logDuration, setLogDuration,
    handleAddSet, currentLogs, selectedLogIdsForGroup, setSelectedLogIdsForGroup,
    handleDragEnd, handleToggleComplete, handleDeleteSet, formatLogValue, handleCreateSuperset,
    handleMarkAllComplete, handleMarkExerciseComplete,
    setShowPlateCalc, setShowCommandPalette, setShowRoutineImportModal, setShowCopyWorkoutDrawer,
    setSelectedExIdsForSuperset, setShowSupersetManagerModal,
    workoutGroups, groupExercises, exercises, categories, selectedDate, handleClearGroup,
    workoutComment, setWorkoutComment, handleSaveComment,
    plateCalcTarget, setPlateCalcTarget, calculatedPlates,
    settings, logComment, setLogComment, handleCopyPreviousSet, handleClearDay,
    startRestTimer, shareWorkout,
    editingLog, handleSelectLogForEdit, handleCancelEdit,
  } = useFitNotesStore();
  const showComplete = settings.mark_sets_complete;

  return (
    <div className="workout-grid">
      {/* Middle: Active set Logger */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {selectedExercise ? (
          <div className="card" style={{ gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="card-title">
                <TrendingUp size={18} color="var(--primary)" />
                {selectedExercise.name}
              </div>
              <button className="btn btn-secondary" onClick={() => setShowPlateCalc(true)}>
                <Calculator size={16} /> Plate Calc
              </button>
            </div>

            {/* Dynamic inputs based on exercise type */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap', width: '100%' }}>
              {typeHasWeight(selectedExercise.exercise_type_id) && (
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Weight ({userUnit})</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button className="btn btn-secondary" style={{ padding: '8px 12px', minWidth: '36px', height: '46px' }} onClick={() => setLogWeight(w => String(Math.max(0, parseFloat(w) - (userUnit === 'kg' ? 2.5 : 5))))}>-</button>
                    <input id="log-weight-input" type="number" value={logWeight} onChange={(e) => setLogWeight(e.target.value)} placeholder="0.0" style={{ textAlign: 'center' }} />
                    <button className="btn btn-secondary" style={{ padding: '8px 12px', minWidth: '36px', height: '46px' }} onClick={() => setLogWeight(w => String((parseFloat(w) || 0) + (userUnit === 'kg' ? 2.5 : 5)))}>+</button>
                  </div>
                </div>
              )}
              {typeHasReps(selectedExercise.exercise_type_id) && (
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Reps</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button className="btn btn-secondary" style={{ padding: '8px 12px', minWidth: '36px', height: '46px' }} onClick={() => setLogReps(r => String(Math.max(0, parseInt(r) - 1)))}>-</button>
                    <input id="log-reps-input" type="number" value={logReps} onChange={(e) => setLogReps(e.target.value)} placeholder="0" style={{ textAlign: 'center' }} />
                    <button className="btn btn-secondary" style={{ padding: '8px 12px', minWidth: '36px', height: '46px' }} onClick={() => setLogReps(r => String((parseInt(r) || 0) + 1))}>+</button>
                  </div>
                </div>
              )}
              {typeHasDistance(selectedExercise.exercise_type_id) && (
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Distance ({settings.distance_unit === 2 ? 'mi' : 'km'})</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button className="btn btn-secondary" style={{ padding: '8px 12px', minWidth: '36px', height: '46px' }} onClick={() => setLogDistance(d => String(Math.max(0, parseFloat(d) - 0.5)))}>-</button>
                    <input id="log-distance-input" type="number" value={logDistance} onChange={(e) => setLogDistance(e.target.value)} placeholder="0.0" style={{ textAlign: 'center' }} />
                    <button className="btn btn-secondary" style={{ padding: '8px 12px', minWidth: '36px', height: '46px' }} onClick={() => setLogDistance(d => String((parseFloat(d) || 0) + 0.5))}>+</button>
                  </div>
                </div>
              )}
              {typeHasDuration(selectedExercise.exercise_type_id) && (
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary-dark)', fontWeight: 600, marginBottom: '6px' }}>Duration (min/sec)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input id="log-duration-min-input" type="number" placeholder="Min" style={{ flex: 1, textAlign: 'center' }} onChange={(e) => {
                      const m = parseInt(e.target.value) || 0;
                      const s = parseInt(logDuration) % 60 || 0;
                      setLogDuration((m * 60 + s).toString());
                    }} value={Math.floor(parseInt(logDuration) / 60) || ''} />
                    <input id="log-duration-sec-input" type="number" placeholder="Sec" style={{ flex: 1, textAlign: 'center' }} onChange={(e) => {
                      const m = Math.floor(parseInt(logDuration) / 60) || 0;
                      const s = parseInt(e.target.value) || 0;
                      setLogDuration((m * 60 + s).toString());
                    }} value={parseInt(logDuration) % 60 || ''} />
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary" onClick={handleAddSet} style={{ height: '46px', whiteSpace: 'nowrap' }}>
                  {editingLog ? <Check size={18} /> : <Plus size={18} />} {editingLog ? 'Update Set' : 'Add Set'}
                </button>
                {editingLog && (
                  <button className="btn btn-secondary" onClick={handleCancelEdit} style={{ height: '46px', whiteSpace: 'nowrap' }}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>

            {/* Set comment + quick actions */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                id="log-comment-input"
                type="text"
                value={logComment}
                onChange={(e) => setLogComment(e.target.value)}
                placeholder="Set comment (optional)"
                style={{ flex: 1, minWidth: '160px', padding: '8px' }}
              />
              <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px' }} onClick={handleCopyPreviousSet}>
                Copy Last
              </button>
              <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px' }} onClick={() => startRestTimer(selectedExercise?.default_rest_time || undefined)}>
                <Timer size={14} /> Rest
              </button>
            </div>

            {/* Logged Sets list */}
            <div style={{ marginTop: '12px' }}>
              <h3 style={{ fontSize: '14px', color: 'var(--text-secondary-dark)', fontWeight: 700, marginBottom: '12px' }}>Logged Sets</h3>
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="logged-sets-list">
                  {(provided) => (
                    <table className="set-table" ref={provided.innerRef} {...provided.droppableProps}>
                      <thead>
                        <tr>
                          <th className="set-th" style={{ width: '40px' }}>Select</th>
                          <th className="set-th" style={{ width: '30px' }}></th>
                          <th className="set-th" style={{ width: '60px' }}>Set</th>
                          <th className="set-th">Target logged</th>
                          {showComplete && <th className="set-th" style={{ width: '100px', textAlign: 'center' }}>Complete</th>}
                          <th className="set-th" style={{ width: '60px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentLogs.filter(x => x.exercise_id === selectedExercise.id).map((log, index) => (
                          <Draggable key={log.id} draggableId={log.id} index={index}>
                            {(draggableProvided) => (
                              <tr
                                ref={draggableProvided.innerRef}
                                {...draggableProvided.draggableProps}
                                className={`set-row ${log.is_complete ? 'completed' : ''}`}
                              >
                                <td className="set-td" style={{ textAlign: 'center' }}>
                                  <input
                                    type="checkbox"
                                    checked={selectedLogIdsForGroup.includes(log.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedLogIdsForGroup([...selectedLogIdsForGroup, log.id]);
                                      } else {
                                        setSelectedLogIdsForGroup(selectedLogIdsForGroup.filter(id => id !== log.id));
                                      }
                                    }}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                  />
                                </td>
                                <td className="set-td" style={{ cursor: 'grab', color: 'var(--text-secondary-dark)' }} {...draggableProvided.dragHandleProps}>
                                  <GripVertical size={14} />
                                </td>
                                <td className="set-td" style={{ fontWeight: 700 }}>{index + 1}</td>
                                <td 
                                  className="set-td" 
                                  style={{ fontWeight: 600, cursor: 'pointer' }}
                                  onClick={() => handleSelectLogForEdit(log)}
                                  title="Click to edit set"
                                >
                                  {formatLogValue(log, selectedExercise.exercise_type_id)}
                                  {log.comment && <span style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', fontWeight: 400, marginLeft: '8px' }}>· {log.comment}</span>}
                                </td>
                                {showComplete && (
                                  <td className="set-td" style={{ textAlign: 'center' }}>
                                    <button
                                      className="btn"
                                      onClick={() => handleToggleComplete(log)}
                                      style={{ padding: '4px 8px', backgroundColor: log.is_complete ? 'var(--success)' : 'rgba(255,255,255,0.05)', color: log.is_complete ? 'white' : 'var(--text-primary-dark)', borderRadius: '6px' }}
                                    >
                                      <Check size={14} />
                                    </button>
                                  </td>
                                )}
                                <td className="set-td">
                                  <button className="btn" onClick={() => handleDeleteSet(log.id)} style={{ padding: '4px', backgroundColor: 'transparent', color: 'var(--danger)' }}>
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </tbody>
                    </table>
                  )}
                </Droppable>
              </DragDropContext>
            </div>

            {/* Superset trigger button */}
            {selectedLogIdsForGroup.length > 0 && (
              <div style={{ backgroundColor: 'var(--primary-glow)', padding: '16px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{selectedLogIdsForGroup.length} sets selected</span>
                <button className="btn btn-primary" onClick={handleCreateSuperset}>
                  <Layers size={14} /> Create Superset Group
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ gap: '20px', padding: '40px 24px', alignItems: 'center', justifyContent: 'center', textAlign: 'center', borderStyle: 'dashed' }}>
            <Dumbbell size={48} color="var(--text-secondary-dark)" style={{ opacity: 0.5, marginBottom: '8px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>No Exercise Selected</h3>
            <p style={{ color: 'var(--text-secondary-dark)', fontSize: '14px', maxWidth: '320px', margin: '4px 0 16px 0' }}>
              Select an exercise to log your sets, reps, and track your workout progress.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-primary" onClick={() => setShowCommandPalette(true)}>
                Select Exercise
              </button>
              <button className="btn btn-secondary" onClick={() => setShowRoutineImportModal(true)}>
                Load Routine
              </button>
            </div>
          </div>
        )}

        {/* TODAY'S WORKOUT SUMMARY PANEL */}
        <div className="card" style={{ gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--primary)" />
              <span>Today's Workout Summary</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {currentLogs.length > 0 && (
                <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleMarkAllComplete}>
                  ✓ Complete All Sets
                </button>
              )}
              <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowCopyWorkoutDrawer(true)}>
                <Bookmark size={14} /> Copy Workout
              </button>
              {currentLogs.length > 0 && (
                <>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={shareWorkout}>
                    <Share2 size={14} /> Share
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', color: 'var(--danger)' }} onClick={handleClearDay}>
                    <Trash2 size={14} /> Clear Day
                  </button>
                </>
              )}
              {currentLogs.length > 0 && (
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => {
                  setSelectedExIdsForSuperset([]);
                  setShowSupersetManagerModal(true);
                }}>
                  <Plus size={14} /> Link Superset Group
                </button>
              )}
            </div>
          </div>

          {currentLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <p style={{ color: 'var(--text-secondary-dark)', fontSize: '13px', margin: 0 }}>
                No sets logged for today yet. Use the logger above or copy a past session.
              </p>
              <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 16px' }} onClick={() => setShowCopyWorkoutDrawer(true)}>
                <Bookmark size={14} color="var(--primary)" /> Copy Past Workout
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {(() => {
                // 1. Identify superset groups active today
                const activeGroups = workoutGroups.filter(wg => wg.date === selectedDate && !wg.is_deleted);
                
                // Group exercise IDs that are part of today's supersets
                const groupExerciseIds = new Set<string>();
                const groupMap: Record<string, typeof activeGroups[0]> = {}; // exerciseId -> group
                
                for (const wg of activeGroups) {
                  const linked = groupExercises.filter(ge => ge.workout_group_id === wg.id && ge.date === selectedDate && !ge.is_deleted);
                  for (const ge of linked) {
                    groupExerciseIds.add(ge.exercise_id);
                    groupMap[ge.exercise_id] = wg;
                  }
                }

                // 2. All exercise IDs with sets logged today
                const loggedExerciseIds = Array.from(new Set(currentLogs.map(l => l.exercise_id)));

                // Create a list of workout items
                const items: Array<
                  | { type: 'superset'; group: typeof activeGroups[0]; exerciseIds: string[]; sortIndex: number }
                  | { type: 'exercise'; exerciseId: string; sortIndex: number }
                > = [];

                // Tracks which superset groups we have already added to the items list
                const addedGroupIds = new Set<string>();

                for (const exId of loggedExerciseIds) {
                  const parentGroup = groupMap[exId];
                  if (parentGroup) {
                    if (!addedGroupIds.has(parentGroup.id)) {
                      addedGroupIds.add(parentGroup.id);
                      
                      // Get all exercises linked to this group
                      const linked = groupExercises
                        .filter(ge => ge.workout_group_id === parentGroup.id && ge.date === selectedDate && !ge.is_deleted)
                        .map(ge => ge.exercise_id);
                        
                      // Find the minimum index of any set in currentLogs belonging to any of these exercises
                      let sortIndex = Infinity;
                      for (const linkedId of linked) {
                        const firstSetIndex = currentLogs.findIndex(l => l.exercise_id === linkedId);
                        if (firstSetIndex !== -1 && firstSetIndex < sortIndex) {
                          sortIndex = firstSetIndex;
                        }
                      }
                      
                      // If no sets are logged yet, fall back to a high number
                      if (sortIndex === Infinity) sortIndex = 999999;

                      items.push({
                        type: 'superset',
                        group: parentGroup,
                        exerciseIds: linked,
                        sortIndex
                      });
                    }
                  } else {
                    // Individual normal exercise
                    const firstSetIndex = currentLogs.findIndex(l => l.exercise_id === exId);
                    items.push({
                      type: 'exercise',
                      exerciseId: exId,
                      sortIndex: firstSetIndex !== -1 ? firstSetIndex : 999999
                    });
                  }
                }

                // Sort ascending by sortIndex
                const sortedItems = items.sort((a, b) => a.sortIndex - b.sortIndex);

                return sortedItems.map((item) => {
                  if (item.type === 'superset') {
                    const wg = item.group;
                    const color = intColorToHex(wg.colour);
                    
                    // Sort exercises inside the superset chronologically based on their first logged set
                    const sortedExIds = [...item.exerciseIds].sort((a, b) => {
                      const idxA = currentLogs.findIndex(l => l.exercise_id === a);
                      const idxB = currentLogs.findIndex(l => l.exercise_id === b);
                      return (idxA !== -1 ? idxA : 9999) - (idxB !== -1 ? idxB : 9999);
                    });

                    return (
                      <div key={wg.id} className="superset-container-panel" style={{ borderLeft: `6px solid ${color}`, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: 'rgba(255, 255, 255, 0.01)', borderRadius: '0 12px 12px 0', border: '1px solid var(--border-dark)', borderLeftWidth: '6px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', backgroundColor: color + '20', color: color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{wg.name || 'Superset Group'}</span>
                            {wg.auto_jump_enabled && <span style={{ fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>• Auto-Jump</span>}
                          </div>
                          <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)' }} onClick={() => handleClearGroup(wg.id)}>
                            Unlink
                          </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          {sortedExIds.map(exId => {
                            const ex = exercises.find(x => x.id === exId);
                            if (!ex) return null;
                            const exLogs = currentLogs.filter(l => l.exercise_id === ex.id);
                            const cat = categories.find(c => c.id === ex.category_id);
                            const catColor = cat ? intColorToHex(cat.colour) : 'var(--text-secondary-dark)';
                            const hasUncompleted = exLogs.some(l => !l.is_complete);

                            return (
                              <div key={exId} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div style={{ fontWeight: 700, fontSize: '14px', cursor: 'pointer', color: 'var(--text-primary-dark)' }} onClick={() => setSelectedExercise(ex)}>
                                    {ex.name}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {exLogs.length > 0 && hasUncompleted && (
                                      <button 
                                        className="btn btn-secondary" 
                                        style={{ padding: '2px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', height: '24px' }} 
                                        onClick={() => handleMarkExerciseComplete(ex.id)}
                                      >
                                        ✓ Complete All
                                      </button>
                                    )}
                                    <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '10px', backgroundColor: catColor + '15', color: catColor, fontWeight: 700 }}>
                                      {cat?.name || 'Misc'}
                                    </span>
                                  </div>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {exLogs.length === 0 ? (
                                    <span style={{ fontSize: '12px', color: 'var(--text-secondary-dark)', fontStyle: 'italic' }}>No sets logged</span>
                                  ) : (
                                    exLogs.map((log, index) => (
                                      <div 
                                        key={log.id} 
                                        onClick={() => handleSelectLogForEdit(log)} 
                                        style={{ 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'space-between', 
                                          padding: '8px 12px', 
                                          borderRadius: '8px', 
                                          fontSize: '13px', 
                                          backgroundColor: log.is_complete ? 'var(--success-glow)' : 'rgba(255,255,255,0.02)', 
                                          border: log.is_complete ? '1px solid var(--success)' : '1px solid var(--border-dark)', 
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease'
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ 
                                            fontSize: '10px', 
                                            fontWeight: 800, 
                                            background: log.is_complete ? 'var(--success)' : 'rgba(255, 255, 255, 0.08)', 
                                            color: 'var(--text-main-dark)', 
                                            padding: '2px 6px', 
                                            borderRadius: '4px',
                                            minWidth: '20px',
                                            textAlign: 'center'
                                          }}>
                                            {index + 1}
                                          </span>
                                          <span style={{ color: log.is_complete ? 'var(--success-text)' : 'var(--text-primary-dark)' }}>
                                            {formatLogValue(log, ex.exercise_type_id)}
                                          </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <div 
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px' }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleToggleComplete(log);
                                            }}
                                            title={log.is_complete ? "Mark Incomplete" : "Mark Complete"}
                                          >
                                            {log.is_complete ? (
                                              <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>✓</span>
                                            ) : (
                                              <span style={{ opacity: 0.2 }}>○</span>
                                            )}
                                          </div>
                                          <button 
                                            className="btn btn-secondary" 
                                            style={{ padding: '2px 6px', border: 'none', backgroundColor: 'transparent', color: 'var(--danger)', opacity: 0.5 }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteSet(log.id);
                                            }}
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  } else {
                    const ex = exercises.find(x => x.id === item.exerciseId);
                    if (!ex) return null;
                    const exLogs = currentLogs.filter(l => l.exercise_id === ex.id);
                    const cat = categories.find(c => c.id === ex.category_id);
                    const catColor = cat ? intColorToHex(cat.colour) : 'var(--text-secondary-dark)';
                    const hasUncompleted = exLogs.some(l => !l.is_complete);

                    return (
                      <div key={ex.id} className="summary-exercise-card" style={{ padding: '16px', border: '1px solid var(--border-dark)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: 'rgba(255,255,255,0.005)', borderLeft: `4px solid ${catColor}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontWeight: 700, fontSize: '15px', cursor: 'pointer', color: 'var(--text-primary-dark)' }} onClick={() => setSelectedExercise(ex)}>
                            {ex.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {exLogs.length > 0 && hasUncompleted && (
                              <button 
                                className="btn btn-secondary" 
                                style={{ padding: '2px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px', height: '24px' }} 
                                onClick={() => handleMarkExerciseComplete(ex.id)}
                              >
                                ✓ Complete All
                              </button>
                            )}
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', backgroundColor: catColor + '15', color: catColor, fontWeight: 700 }}>
                              {cat?.name || 'Misc'}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {exLogs.map((log, index) => (
                            <div 
                              key={log.id} 
                              onClick={() => handleSelectLogForEdit(log)} 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between', 
                                padding: '8px 12px', 
                                borderRadius: '8px', 
                                fontSize: '13px', 
                                backgroundColor: log.is_complete ? 'var(--success-glow)' : 'rgba(255,255,255,0.02)', 
                                border: log.is_complete ? '1px solid var(--success)' : '1px solid var(--border-dark)', 
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ 
                                  fontSize: '10px', 
                                  fontWeight: 800, 
                                  background: log.is_complete ? 'var(--success)' : 'rgba(255, 255, 255, 0.08)', 
                                  color: 'var(--text-main-dark)', 
                                  padding: '2px 6px', 
                                  borderRadius: '4px',
                                  minWidth: '20px',
                                  textAlign: 'center'
                                }}>
                                  {index + 1}
                                </span>
                                <span style={{ color: log.is_complete ? 'var(--success-text)' : 'var(--text-primary-dark)' }}>
                                  {formatLogValue(log, ex.exercise_type_id)}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div 
                                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleComplete(log);
                                  }}
                                  title={log.is_complete ? "Mark Incomplete" : "Mark Complete"}
                                >
                                  {log.is_complete ? (
                                    <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>✓</span>
                                  ) : (
                                    <span style={{ opacity: 0.2 }}>○</span>
                                  )}
                                </div>
                                <button 
                                  className="btn btn-secondary" 
                                  style={{ padding: '2px 6px', border: 'none', backgroundColor: 'transparent', color: 'var(--danger)', opacity: 0.5 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSet(log.id);
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                });
              })()}
            </div>
          )}
        </div>

        {/* Workout comments */}
        <div className="card">
          <div className="card-title"><FileText size={16} /> Workout Comments</div>
          <textarea
            value={workoutComment}
            onChange={(e) => setWorkoutComment(e.target.value)}
            placeholder="Enter notes, targets, or mood for today's session..."
            rows={3}
          />
          <button className="btn btn-secondary" onClick={handleSaveComment} style={{ alignSelf: 'flex-end' }}>
            Save Comments
          </button>
        </div>
      </div>

      {/* Right: Plate loading visualizer side panel */}
      <div className="card" style={{ gap: '20px' }}>
        <div className="card-title"><Calculator size={16} /> Plate Loading Visual</div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>See color-coded plates loaded onto a standard {userUnit === 'kg' ? '20kg' : '45lbs'} barbell sleeve:</p>

        <div style={{ display: 'flex', gap: '12px' }}>
          <input
            type="number"
            value={plateCalcTarget}
            onChange={(e) => setPlateCalcTarget(parseFloat(e.target.value) || 0)}
            placeholder="Target Weight"
          />
        </div>

        {/* Premium Barbell Draw */}
        <div className="barbell-preview">
          <div className="barbell-shaft">
            <div className="barbell-sleeve right">
              {calculatedPlates.flatMap(p =>
                Array.from({ length: p.count }).map((_, i) => (
                  <div
                    key={`${p.weight}-${i}`}
                    className="loaded-plate"
                    style={{
                      width: `${p.weight * (userUnit === 'kg' ? 3.5 : 1.6)}px`,
                      height: `${80 - ((userUnit === 'kg' ? 20 : 45) - p.weight) * (userUnit === 'kg' ? 2 : 0.9)}%`,
                      backgroundColor: p.color,
                    }}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {calculatedPlates.map(p => (
            <div key={p.weight} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: p.color }}></div>
                <span>{p.weight} {userUnit} Plate</span>
              </div>
              <span style={{ fontWeight: 700 }}>x{p.count * 2} <span style={{ color: 'var(--text-secondary-dark)', fontWeight: 400 }}>( {p.count} each side )</span></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
