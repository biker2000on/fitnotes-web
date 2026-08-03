// ExercisePicker.tsx - The single exercise picker used everywhere.
//
// The workout log (quick search) and the routine editor (add / switch an
// exercise in a section) used to ship two unrelated pickers that had drifted
// apart in look and behaviour. This is the merged one: the workout log's
// keyboard-first palette, plus the two things the routine editor genuinely
// needs - category filter pills and per-row availability state (an exercise
// already in the day, or the one being switched away from, cannot be picked).
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Keyboard } from 'lucide-react';
import { getExerciseTypeLabel } from '../lib/units';

export interface PickerExercise {
  id: string;
  name: string;
  category_id: string | null;
  exercise_type_id: number;
  is_deleted?: boolean;
  [key: string]: any;
}

interface PickerCategory {
  id: string;
  name: string;
  colour: number;
}

// Why a row cannot be chosen. `reason` renders as its own muted chip rather
// than being folded into the name - dimming the whole row (the old
// opacity: 0.55) made the exercise name unreadable against the dark surface.
export interface PickerItemState {
  disabled?: boolean;
  reason?: string;
}

interface ExercisePickerProps<T extends PickerExercise> {
  isOpen: boolean;
  onClose: () => void;
  exercises: T[];
  categories: PickerCategory[];
  intColorToHex: (num: number) => string;
  onSelectExercise: (exercise: T) => void;
  /** Header title. Omit for the bare quick-search palette. */
  title?: string;
  /** Controlled search text. Omit to let the picker own it. */
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  /** Render category filter pills. */
  showCategoryFilter?: boolean;
  selectedCategoryId?: string | null;
  onSelectCategory?: (id: string | null) => void;
  getItemState?: (exercise: T) => PickerItemState;
}

export function ExercisePicker<T extends PickerExercise>({
  isOpen,
  onClose,
  exercises,
  categories,
  intColorToHex,
  onSelectExercise,
  title,
  searchQuery,
  onSearchChange,
  showCategoryFilter = false,
  selectedCategoryId = null,
  onSelectCategory,
  getItemState,
}: ExercisePickerProps<T>) {
  const [internalSearch, setInternalSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isControlledSearch = searchQuery !== undefined;
  const search = isControlledSearch ? searchQuery : internalSearch;
  const setSearch = (value: string) => {
    if (onSearchChange) onSearchChange(value);
    if (!isControlledSearch) setInternalSearch(value);
  };

  const filtered = exercises.filter(ex => {
    if (ex.is_deleted) return false;
    if (!ex.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (showCategoryFilter && selectedCategoryId !== null && ex.category_id !== selectedCategoryId) return false;
    return true;
  });

  const stateFor = useCallback(
    (ex: T): PickerItemState => (getItemState ? getItemState(ex) : {}),
    [getItemState],
  );

  // Keyboard navigation steps over unavailable rows; landing the highlight on a
  // row that Enter cannot select reads as a broken palette.
  const findEnabled = useCallback((from: number, dir: 1 | -1): number => {
    if (filtered.length === 0) return 0;
    for (let step = 0; step < filtered.length; step += 1) {
      const idx = (((from + dir * step) % filtered.length) + filtered.length) % filtered.length;
      if (!stateFor(filtered[idx]).disabled) return idx;
    }
    return from;
  }, [filtered, stateFor]);

  useEffect(() => {
    if (isOpen) {
      if (!isControlledSearch) setInternalSearch('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(prev => (filtered.length === 0 ? 0 : findEnabled(prev >= filtered.length ? 0 : prev, 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedCategoryId, exercises.length]);

  // Keep the highlighted row inside the scroll viewport.
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[activeIndex] as HTMLElement | undefined;
    if (!activeEl) return;
    const listHeight = listRef.current.clientHeight;
    const elTop = activeEl.offsetTop;
    const elHeight = activeEl.clientHeight;
    const currentScroll = listRef.current.scrollTop;
    if (elTop < currentScroll) {
      listRef.current.scrollTop = elTop;
    } else if (elTop + elHeight > currentScroll + listHeight) {
      listRef.current.scrollTop = elTop + elHeight - listHeight;
    }
  }, [activeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => findEnabled(prev + 1, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => findEnabled(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const ex = filtered[activeIndex];
      if (ex && !stateFor(ex).disabled) onSelectExercise(ex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay mobile-modal-overlay" onClick={onClose} style={{ zIndex: 100000 }}>
      <div
        className="modal-content mobile-modal-content"
        style={{
          maxWidth: '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-dark)',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)',
          overflow: 'hidden',
          padding: 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 20px 0 20px', flexShrink: 0,
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0 }}>{title}</h2>
            <button className="btn btn-secondary" style={{ padding: '6px 12px' }} onClick={onClose}>Close</button>
          </div>
        )}

        {/* Search bar */}
        <div style={{
          display: 'flex', alignItems: 'center', padding: '16px 20px',
          borderBottom: showCategoryFilter ? 'none' : '1px solid var(--border-dark)',
          gap: '12px', flexShrink: 0,
        }}>
          <Search size={20} color="var(--primary)" style={{ opacity: 0.8 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type to search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1, backgroundColor: 'transparent', border: 'none',
              color: 'var(--text-primary-dark)', fontSize: '16px', fontWeight: 600, outline: 'none',
            }}
          />
          <span style={{
            fontSize: '11px', padding: '4px 8px', borderRadius: '6px',
            backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary-dark)', fontWeight: 700,
          }}>
            ESC
          </span>
        </div>

        {showCategoryFilter && (
          <div className="category-pill-row" style={{ padding: '0 16px 12px 16px', borderBottom: '1px solid var(--border-dark)', flexShrink: 0 }}>
            <button
              className="btn"
              style={{
                padding: '6px 12px', fontSize: '12px', borderRadius: '20px',
                backgroundColor: selectedCategoryId === null ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                color: selectedCategoryId === null ? 'white' : 'var(--text-primary-dark)',
                border: '1px solid var(--border-dark)',
              }}
              onClick={() => onSelectCategory?.(null)}
            >
              All Categories
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                className="btn"
                style={{
                  padding: '6px 12px', fontSize: '12px', borderRadius: '20px',
                  backgroundColor: selectedCategoryId === cat.id ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                  color: selectedCategoryId === cat.id ? 'white' : 'var(--text-primary-dark)',
                  border: '1px solid var(--border-dark)',
                }}
                onClick={() => onSelectCategory?.(cat.id)}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}

        {/* Results */}
        <div
          ref={listRef}
          style={{ flexGrow: 1, minHeight: 0, maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: '8px' }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary-dark)', fontSize: '14px' }}>
              No exercises match your search query.
            </div>
          ) : (
            filtered.map((ex, index) => {
              const cat = categories.find(c => c.id === ex.category_id);
              const catColor = cat ? intColorToHex(cat.colour) : 'var(--text-secondary-dark)';
              const { disabled = false, reason } = stateFor(ex);
              const isActive = index === activeIndex && !disabled;

              return (
                <button
                  type="button"
                  key={ex.id}
                  disabled={disabled}
                  onClick={() => { if (!disabled) onSelectExercise(ex); }}
                  onMouseEnter={() => { if (!disabled) setActiveIndex(index); }}
                  aria-label={`${ex.name}${reason ? ` (${reason})` : ''}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    textAlign: 'left',
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <span style={{
                      fontWeight: isActive ? 700 : 600,
                      fontSize: '14px',
                      // Explicit colour rather than opacity: a dimmed row over
                      // the translucent modal surface fell below readable.
                      color: disabled
                        ? 'var(--text-secondary-dark)'
                        : isActive ? 'var(--primary)' : 'var(--text-primary-dark)',
                    }}>
                      {ex.name}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>
                      {getExerciseTypeLabel(ex.exercise_type_id)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {reason && (
                      <span style={{
                        fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        color: 'var(--text-secondary-dark)', fontWeight: 700, whiteSpace: 'nowrap',
                      }}>
                        {reason}
                      </span>
                    )}
                    <span style={{
                      fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
                      backgroundColor: catColor + '15', color: catColor, fontWeight: 700, whiteSpace: 'nowrap',
                    }}>
                      {cat?.name || 'Misc'}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 20px', borderTop: '1px solid var(--border-dark)',
          backgroundColor: 'rgba(0,0,0,0.1)', fontSize: '11px',
          color: 'var(--text-secondary-dark)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Keyboard size={12} />
            <span>Use <kbd style={{ padding: '2px 4px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '4px', margin: '0 2px' }}>↑↓</kbd> keys to navigate</span>
          </div>
          <div>
            <span>Press <kbd style={{ padding: '2px 4px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '4px', margin: '0 2px' }}>Enter</kbd> to select</span>
          </div>
        </div>
      </div>
    </div>
  );
};
