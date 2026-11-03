// RoutinesView.tsx - Every routine as one compact row: how many days, when it
// was last trained, and which day is up next, with Start right there. Tapping
// the row opens the routine page for detail and editing.
import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, ChevronRight, Play } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { db } from '../storage/db';
import { getLocalDateString } from '../lib/date';
import { nextDayId } from '../lib/routinePlan';
import { formatTargetDate } from '../store/slices/useRoutinesSlice';
import type { Routine, RoutineSection } from '../types';

type RoutineSortMode = 'recent' | 'nameAsc' | 'mostCompleted';

const bySortOrder = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

export function RoutinesView() {
  const {
    routines, setShowCreateRoutineModal, setEditingRoutine, setActiveTab,
    workoutRoutines, setActiveSectionForPopulate, setPopulateTargetDate, editorSections,
    editingRoutine, activeTab,
  } = useFitNotesStore();

  const [sections, setSections] = useState<RoutineSection[]>([]);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [sortMode, setSortMode] = useState<RoutineSortMode>(() => {
    const saved = localStorage.getItem('fn_routine_sort_mode');
    return saved === 'nameAsc' || saved === 'mostCompleted' ? saved : 'recent';
  });

  // Day lists for every routine; refreshed when routines change or the editor
  // has touched days.
  useEffect(() => {
    let cancelled = false;
    db.query<RoutineSection>('SELECT * FROM routine_sections')
      .then(rows => { if (!cancelled) setSections(rows.filter(row => !row.is_deleted)); })
      .catch(err => console.error('Failed to load routine days:', err));
    return () => { cancelled = true; };
  }, [routines, editorSections]);

  const daysByRoutine = useMemo(() => {
    const map: Record<string, RoutineSection[]> = {};
    for (const section of sections) (map[section.routine_id] ||= []).push(section);
    for (const list of Object.values(map)) list.sort(bySortOrder);
    return map;
  }, [sections]);

  const stats = useMemo(() => {
    const byRoutine: Record<string, { count: number; last: string }> = {};
    const bySection: Record<string, string> = {};
    for (const link of workoutRoutines) {
      if (link.is_deleted) continue;
      const entry = byRoutine[link.routine_id] ||= { count: 0, last: '' };
      entry.count += 1;
      if (link.date > entry.last) entry.last = link.date;
      if (link.routine_section_id && link.date > (bySection[link.routine_section_id] ?? '')) bySection[link.routine_section_id] = link.date;
    }
    return { byRoutine, bySection };
  }, [workoutRoutines]);

  const categories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of routines) {
      const cat = (r.category ?? '').trim();
      if (cat && !seen.has(cat.toLowerCase())) seen.set(cat.toLowerCase(), cat);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [routines]);

  const archivedCount = routines.filter(r => r.is_archived).length;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = routines.filter(r => {
      if (!showArchived && r.is_archived) return false;
      const cat = (r.category ?? '').trim();
      if (categoryFilter && cat.toLowerCase() !== categoryFilter.toLowerCase()) return false;
      if (!needle) return true;
      const dayNames = (daysByRoutine[r.id] ?? []).map(d => d.name).join(' ');
      return `${r.name} ${r.notes ?? ''} ${cat} ${dayNames}`.toLowerCase().includes(needle);
    });
    const byName = (a: Routine, b: Routine) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    return filtered.sort((a, b) => {
      if (sortMode === 'nameAsc') return byName(a, b);
      if (sortMode === 'mostCompleted') return (stats.byRoutine[b.id]?.count ?? 0) - (stats.byRoutine[a.id]?.count ?? 0) || byName(a, b);
      return (stats.byRoutine[b.id]?.last ?? '').localeCompare(stats.byRoutine[a.id]?.last ?? '') || byName(a, b);
    });
  }, [routines, query, categoryFilter, showArchived, sortMode, stats, daysByRoutine]);

  const updateSort = (mode: RoutineSortMode) => {
    setSortMode(mode);
    localStorage.setItem('fn_routine_sort_mode', mode);
  };

  const openRoutine = (routine: Routine) => {
    setEditingRoutine(routine);
    setActiveTab('routine-editor');
  };

  const startNext = (day: RoutineSection) => {
    setPopulateTargetDate(getLocalDateString());
    setActiveSectionForPopulate(day);
  };

  if (routines.length === 0) {
    return (
      <div className="empty-state">
        <p className="empty-title">No routines yet</p>
        <p>A routine is your program: a few days, each with the exercises you do together. Start one and add its first day.</p>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreateRoutineModal(true)}>
          <Plus size={16} aria-hidden /> New routine
        </button>
      </div>
    );
  }

  return (
    <div className="routine-list">
      <div className="routines-toolbar">
        <label className="search-field">
          <Search size={16} aria-hidden />
          <input type="search" placeholder="Search routines and days" value={query} onChange={e => setQuery(e.target.value)} aria-label="Search routines" />
        </label>
        {categories.length > 0 && (
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} aria-label="Category">
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select value={sortMode} onChange={e => updateSort(e.target.value as RoutineSortMode)} aria-label="Sort routines">
          <option value="recent">Recently done</option>
          <option value="nameAsc">Name</option>
          <option value="mostCompleted">Most done</option>
        </select>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreateRoutineModal(true)}>
          <Plus size={16} aria-hidden /> New routine
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="field-hint" style={{ padding: '24px 4px' }}>No routines match “{query}”.</p>
      ) : (
        <div className="routine-list-group">
          <div className="routine-rows">
            {visible.map(routine => {
              const days = daysByRoutine[routine.id] ?? [];
              const nextId = nextDayId(days, stats.bySection);
              const next = days.find(d => d.id === nextId) ?? null;
              const last = stats.byRoutine[routine.id]?.last;
              return (
                <div key={routine.id} className={`routine-row${activeTab === 'routine-editor' && editingRoutine?.id === routine.id ? ' is-active' : ''}`}>
                  <button
                    type="button"
                    className="routine-row-open"
                    onClick={() => openRoutine(routine)}
                    aria-current={activeTab === 'routine-editor' && editingRoutine?.id === routine.id ? 'true' : undefined}
                  >
                    <span className="routine-row-name">{routine.name}</span>
                    <span className="routine-row-meta">
                      {days.length} day{days.length === 1 ? '' : 's'}
                      {last ? ` · last ${formatTargetDate(last)}` : ' · not done yet'}
                      {routine.is_archived ? ' · archived' : ''}
                      {next && days.length > 1 ? <> · next <b>{next.name}</b></> : null}
                    </span>
                  </button>
                  <div className="routine-row-actions">
                    {next && (
                      <button type="button" className="btn btn-secondary" onClick={() => startNext(next)} aria-label={`Start ${next.name} from ${routine.name}`}>
                        <Play size={16} aria-hidden /> Start
                      </button>
                    )}
                    <ChevronRight size={20} aria-hidden className="chev" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {archivedCount > 0 && (
        <label className="check-field routine-archived-toggle">
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
          <span>Show {archivedCount} archived</span>
        </label>
      )}
    </div>
  );
}
