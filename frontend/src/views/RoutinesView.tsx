// RoutinesView.tsx - Expanded interactive list of routines with section (Workout Day) populating.
import { useMemo, useState } from 'react';
import { Bookmark, Plus, ChevronDown, ChevronUp, Play, Dumbbell, Search, Trash2 } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { db } from '../storage/db';
import { intColorToHex } from '../lib/colors';
import type { RoutineSection, RoutineSectionExercise, RoutineSectionExerciseSet, WorkoutGroup, WorkoutGroupExercise } from '../types';

const bySortOrder = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;
const isGenericSupersetName = (name?: string | null) => /^superset\s+\d+$/i.test((name || '').trim());

export function RoutinesView() {
  const {
    routines, setShowCreateRoutineModal, setEditingRoutine, setActiveTab,
    setActiveRoutineForPopulate, setActiveSectionForPopulate, exercises, handleDeleteRoutine
  } = useFitNotesStore();

  const [expandedRoutineId, setExpandedRoutineId] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [routineDetails, setRoutineDetails] = useState<{
    sections: RoutineSection[];
    exercises: RoutineSectionExercise[];
    sets: RoutineSectionExerciseSet[];
    groups: WorkoutGroup[];
    groupExercises: WorkoutGroupExercise[];
  } | null>(null);
  const [routineFilter, setRoutineFilter] = useState('');

  const filteredRoutines = useMemo(() => {
    const needle = routineFilter.trim().toLowerCase();
    if (!needle) return routines;
    return routines.filter(r => [
      r.name,
      r.notes ?? '',
    ].join(' ').toLowerCase().includes(needle));
  }, [routineFilter, routines]);

  // Toggle routine card expansion and load details inline
  const handleToggleExpand = async (routineId: string) => {
    if (expandedRoutineId === routineId) {
      setExpandedRoutineId(null);
      setRoutineDetails(null);
      return;
    }

    setExpandedRoutineId(routineId);
    setLoadingDetails(true);
    setRoutineDetails(null);

    try {
      // Query sections
      const rawSecs = await db.query<RoutineSection>(
        'SELECT * FROM routine_sections WHERE routine_id = ? ORDER BY sort_order ASC',
        [routineId]
      );
      const secs = rawSecs.filter(sec => !sec.is_deleted).sort(bySortOrder);
      
      let rseList: RoutineSectionExercise[] = [];
      let rseSets: RoutineSectionExerciseSet[] = [];
      let routineGroups: WorkoutGroup[] = [];
      let routineGroupExercises: WorkoutGroupExercise[] = [];

      if (secs.length > 0) {
        const secIds = secs.map(s => s.id);
        const secPlaceholders = secIds.map(() => '?').join(',');
        
          const rawRseList = await db.query<RoutineSectionExercise>(
            `SELECT * FROM routine_section_exercises WHERE routine_section_id IN (${secPlaceholders}) ORDER BY sort_order ASC`,
            secIds
          );
          rseList = rawRseList.filter(se => !se.is_deleted).sort(bySortOrder);

          if (rseList.length > 0) {
            const rseIds = rseList.map(e => e.id);
            const rsePlaceholders = rseIds.map(() => '?').join(',');
            
          const rawRseSets = await db.query<RoutineSectionExerciseSet>(
            `SELECT * FROM routine_section_exercise_sets WHERE routine_section_exercise_id IN (${rsePlaceholders})`,
            rseIds
          );
          rseSets = rawRseSets.filter(set => !set.is_deleted).sort(bySortOrder);
        }

        const allGroups = await db.query<WorkoutGroup>('SELECT * FROM workout_groups');
        routineGroups = allGroups.filter(g => g.routine_section_id && secIds.includes(g.routine_section_id) && !g.is_deleted);

        if (routineGroups.length > 0) {
          const groupIds = routineGroups.map(g => g.id);
          const allGroupExercises = await db.query<WorkoutGroupExercise>('SELECT * FROM workout_group_exercises');
          routineGroupExercises = allGroupExercises.filter(ge => groupIds.includes(ge.workout_group_id) && !ge.is_deleted);
        }
      }

      setRoutineDetails({
        sections: secs,
        exercises: rseList,
        sets: rseSets,
        groups: routineGroups,
        groupExercises: routineGroupExercises
      });
    } catch (e) {
      console.error('Failed to load routine sections & exercises:', e);
    } finally {
      setLoadingDetails(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bookmark size={18} color="var(--primary)" />
            <span>Routine Templates</span>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreateRoutineModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> Create Routine Template
          </button>
        </div>

        <div className="routine-filter-row">
          <Search size={16} />
          <input
            type="search"
            placeholder="Filter routines"
            value={routineFilter}
            onChange={(e) => setRoutineFilter(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {routines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-secondary-dark)' }}>
              <Bookmark size={32} style={{ opacity: 0.2, marginBottom: '8px', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
              No routine templates created yet.
            </div>
          ) : filteredRoutines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary-dark)', fontSize: '13px' }}>
              No routine templates match your filter.
            </div>
          ) : (
            filteredRoutines.map(r => {
              const isExpanded = expandedRoutineId === r.id;
              return (
                <div
                  key={r.id}
                  style={{
                    border: '1px solid var(--border-dark)',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(255, 255, 255, 0.01)',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                    borderColor: isExpanded ? 'rgba(99, 102, 241, 0.3)' : 'var(--border-dark)',
                    boxShadow: isExpanded ? '0 4px 20px rgba(0,0,0,0.2)' : 'none'
                  }}
                >
                  {/* Card Header (Tappable Row) */}
                  <div
                    style={{
                      padding: '20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: isExpanded ? 'rgba(99, 102, 241, 0.02)' : 'transparent'
                    }}
                    onClick={() => handleToggleExpand(r.id)}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary-dark)' }}>{r.name}</h3>
                        {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--text-secondary-dark)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-secondary-dark)' }} />}
                      </div>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', marginTop: '4px' }}>{r.notes || 'No notes added.'}</p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 12px' }} 
                        onClick={() => {
                          setEditingRoutine(r);
                          setActiveTab('routine-editor');
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 10px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                        onClick={() => handleDeleteRoutine(r.id)}
                        title="Delete routine"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                      <button 
                        className="btn btn-primary" 
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 12px' }} 
                        onClick={() => setActiveRoutineForPopulate(r)}
                      >
                        Start Split
                      </button>
                    </div>
                  </div>

                  {/* Card Expanded Content */}
                  {isExpanded && (
                    <div style={{ padding: '20px', borderTop: '1px solid var(--border-dark)', backgroundColor: 'rgba(0,0,0,0.08)' }}>
                      {loadingDetails ? (
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', padding: '12px 0' }}>Loading workout days...</div>
                      ) : !routineDetails || routineDetails.sections.length === 0 ? (
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary-dark)', padding: '12px 0' }}>No workout days added to this routine yet. Edit the template to add days.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                          <h4 style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.5px', marginBottom: '4px' }}>Workout Day Splits (Select to Start)</h4>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                            {routineDetails.sections.map(sec => {
                              const secExs = routineDetails.exercises.filter(x => x.routine_section_id === sec.id).sort(bySortOrder);
                              const groupLabelById = new Map<string, string>();
                              for (const se of secExs) {
                                const linked = routineDetails.groupExercises.find(ge => ge.routine_section_id === sec.id && ge.exercise_id === se.exercise_id);
                                const group = linked ? routineDetails.groups.find(g => g.id === linked.workout_group_id) : null;
                                if (group && isGenericSupersetName(group.name) && !groupLabelById.has(group.id)) {
                                  groupLabelById.set(group.id, `Superset ${groupLabelById.size + 1}`);
                                }
                              }
                              
                              return (
                                <div 
                                  key={sec.id}
                                  style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid var(--border-dark)',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    gap: '12px',
                                    transition: 'border-color 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
                                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-dark)'}
                                >
                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                      <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-primary-dark)' }}>{sec.name}</div>
                                    </div>
                                    
                                    {/* Exercise list inside split */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                                      {secExs.length === 0 ? (
                                        <div style={{ fontStyle: 'italic', fontSize: '12px', color: 'var(--text-secondary-dark)' }}>No exercises</div>
                                      ) : (
                                        secExs.map(se => {
                                          const exName = exercises.find(x => x.id === se.exercise_id)?.name || 'Unknown Exercise';
                                          const setsCount = routineDetails.sets.filter(s => s.routine_section_exercise_id === se.id).length;
                                          const linkedGroupEx = routineDetails.groupExercises.find(ge => ge.routine_section_id === sec.id && ge.exercise_id === se.exercise_id);
                                          const group = linkedGroupEx ? routineDetails.groups.find(g => g.id === linkedGroupEx.workout_group_id) : null;
                                          const groupColor = group ? intColorToHex(group.colour) : null;
                                          const groupLabel = group ? (groupLabelById.get(group.id) || group.name) : null;
                                          
                                          return (
                                            <div key={se.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary-dark)', borderLeft: groupColor ? `3px solid ${groupColor}` : '3px solid transparent', paddingLeft: groupColor ? '6px' : 0 }}>
                                              <Dumbbell size={12} style={{ flexShrink: 0, opacity: 0.5 }} />
                                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{exName}</span>
                                              {group && (
                                                <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: groupColor || 'var(--primary)', backgroundColor: groupColor ? `${groupColor}20` : 'rgba(99, 102, 241, 0.12)', borderRadius: '4px', padding: '2px 5px' }}>
                                                  {groupLabel}
                                                </span>
                                              )}
                                              <span style={{ fontSize: '11px', fontWeight: 700, opacity: 0.7 }}>({setsCount} {setsCount === 1 ? 'set' : 'sets'})</span>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  </div>

                                  <button 
                                    className="btn btn-primary" 
                                    style={{ 
                                      width: '100%', 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      justifyContent: 'center', 
                                      gap: '6px', 
                                      fontSize: '12px',
                                      padding: '8px 12px',
                                      marginTop: '8px'
                                    }}
                                    onClick={() => {
                                      // Trigger start of only this Workout Day split
                                      setActiveSectionForPopulate(sec);
                                    }}
                                  >
                                    <Play size={12} fill="currentColor" /> Start Workout Day
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
