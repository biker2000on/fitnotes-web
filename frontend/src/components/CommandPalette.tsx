import React, { useState, useEffect, useRef } from 'react';
import { Search, Keyboard } from 'lucide-react';

interface Exercise {
  id: string;
  name: string;
  category_id: string | null;
  exercise_type_id: number;
  notes?: string;
  weight_increment?: number;
  default_rest_time?: number;
  weight_unit_id?: number;
  is_favourite: boolean;
}

interface Category {
  id: string;
  name: string;
  colour: number;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  exercises: Exercise[];
  categories: Category[];
  intColorToHex: (num: number) => string;
  onSelectExercise: (exercise: Exercise) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  exercises,
  categories,
  intColorToHex,
  onSelectExercise
}) => {
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setActiveIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  const filtered = exercises.filter(ex => 
    ex.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [search]);

  // Handle arrow key and enter scroll tracking
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        const listHeight = listRef.current.clientHeight;
        const elTop = activeEl.offsetTop;
        const elHeight = activeEl.clientHeight;
        const currentScroll = listRef.current.scrollTop;

        if (elTop < currentScroll) {
          listRef.current.scrollTop = elTop;
        } else if (elTop + elHeight > currentScroll + listHeight) {
          listRef.current.scrollTop = elTop + elHeight - listHeight;
        }
      }
    }
  }, [activeIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[activeIndex]) {
        onSelectExercise(filtered[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 100000 }}>
      <div 
        className="modal-content" 
        style={{ 
          maxWidth: '600px', 
          backgroundColor: 'rgba(30, 41, 59, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-dark)',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)',
          overflow: 'hidden',
          padding: 0
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-dark)', gap: '12px' }}>
          <Search size={20} color="var(--primary)" style={{ opacity: 0.8 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type to search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              color: 'var(--text-primary-dark)',
              fontSize: '16px',
              fontWeight: 600,
              outline: 'none'
            }}
          />
          <span style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary-dark)', fontWeight: 700 }}>
            ESC
          </span>
        </div>

        {/* Exercises List Results */}
        <div 
          ref={listRef}
          style={{ 
            maxHeight: '320px', 
            overflowY: 'auto', 
            display: 'flex', 
            flexDirection: 'column',
            padding: '8px'
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary-dark)', fontSize: '14px' }}>
              No exercises match your search query.
            </div>
          ) : (
            filtered.map((ex, index) => {
              const cat = categories.find(c => c.id === ex.category_id);
              const catColor = cat ? intColorToHex(cat.colour) : 'var(--text-secondary-dark)';
              const isActive = index === activeIndex;

              return (
                <div
                  key={ex.id}
                  onClick={() => onSelectExercise(ex)}
                  onMouseEnter={() => setActiveIndex(index)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    border: isActive ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid transparent',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ 
                      fontWeight: isActive ? 700 : 600, 
                      fontSize: '14px', 
                      color: isActive ? 'var(--primary)' : 'var(--text-primary-dark)' 
                    }}>
                      {ex.name}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary-dark)' }}>
                      {ex.exercise_type_id === 1 ? 'Weight & Reps' : 'Cardio'}
                    </span>
                  </div>

                  <span style={{ 
                    fontSize: '10px', 
                    padding: '2px 8px', 
                    borderRadius: '10px', 
                    backgroundColor: catColor + '15', 
                    color: catColor, 
                    fontWeight: 700 
                  }}>
                    {cat?.name || 'Misc'}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '12px 20px', 
          borderTop: '1px solid var(--border-dark)', 
          backgroundColor: 'rgba(0,0,0,0.1)', 
          fontSize: '11px',
          color: 'var(--text-secondary-dark)'
        }}
        >
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
