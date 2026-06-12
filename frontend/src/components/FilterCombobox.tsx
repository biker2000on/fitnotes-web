// FilterCombobox.tsx - Searchable, grouped dropdown replacing native <select>
// for filtering. Type-to-search, keyboard navigation (arrows/Enter/Escape),
// themed panel (no native option styling), bottom-sheet presentation on mobile.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface ComboOption {
  value: string;
  label: string;
}

export interface ComboGroup {
  label: string;
  options: ComboOption[];
}

interface FilterComboboxProps {
  value: string;
  onChange: (value: string) => void;
  groups: ComboGroup[];
  /** Label shown when nothing is selected; also the "clear" option. */
  placeholder: string;
  className?: string;
}

export function FilterCombobox({ value, onChange, groups, placeholder, className }: FilterComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(() => {
    for (const g of groups) {
      const hit = g.options.find(o => o.value === value);
      if (hit) return hit.label;
    }
    return null;
  }, [groups, value]);

  const filteredGroups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return groups;
    return groups
      .map(g => ({ ...g, options: g.options.filter(o => o.label.toLowerCase().includes(needle)) }))
      .filter(g => g.options.length > 0);
  }, [groups, query]);

  // Flat list of selectable options in render order, for keyboard navigation.
  const flatOptions = useMemo(
    () => filteredGroups.flatMap(g => g.options),
    [filteredGroups],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // Focus search as soon as the panel opens.
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const choose = (val: string) => {
    onChange(val);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      setQuery('');
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, flatOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = flatOptions[activeIndex];
      if (opt) choose(opt.value);
    }
  };

  // Keep the active option scrolled into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  let runningIndex = -1;

  return (
    <div ref={rootRef} className={`filter-combobox ${className || ''}`}>
      <button
        type="button"
        className={`filter-combobox-trigger ${value ? 'has-value' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="filter-combobox-label">{selectedLabel || placeholder}</span>
        {value ? (
          <span
            role="button"
            aria-label="Clear filter"
            className="filter-combobox-clear"
            onClick={(e) => { e.stopPropagation(); choose(''); }}
          >
            <X size={14} />
          </span>
        ) : (
          <ChevronDown size={15} className="filter-combobox-chevron" />
        )}
      </button>

      {open && (
        <>
          <div className="filter-combobox-backdrop" onClick={() => { setOpen(false); setQuery(''); }} />
          <div className="filter-combobox-panel" role="listbox" onKeyDown={onKeyDown}>
            <div className="filter-combobox-search">
              <Search size={15} />
              <input
                ref={inputRef}
                type="text"
                placeholder="Type to search..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="filter-combobox-list" ref={listRef}>
              {!query && (
                <div
                  className={`filter-combobox-option ${value === '' ? 'selected' : ''}`}
                  onClick={() => choose('')}
                >
                  <span>{placeholder}</span>
                  {value === '' && <Check size={14} />}
                </div>
              )}
              {filteredGroups.length === 0 ? (
                <div className="filter-combobox-empty">No matches.</div>
              ) : (
                filteredGroups.map(group => (
                  <div key={group.label}>
                    <div className="filter-combobox-group-label">{group.label}</div>
                    {group.options.map(opt => {
                      runningIndex += 1;
                      const idx = runningIndex;
                      return (
                        <div
                          key={opt.value}
                          data-idx={idx}
                          className={`filter-combobox-option ${opt.value === value ? 'selected' : ''} ${idx === activeIndex ? 'active' : ''}`}
                          onClick={() => choose(opt.value)}
                          onMouseEnter={() => setActiveIndex(idx)}
                        >
                          <span>{opt.label}</span>
                          {opt.value === value && <Check size={14} />}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
