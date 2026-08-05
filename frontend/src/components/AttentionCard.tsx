// AttentionCard.tsx - Keyboard-first triage for workout signals. The feed is
// available only on today/future workout logs and all detail stays in context.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { AlertTriangle, TrendingDown, Target, Activity, Clock, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import { getLocalDateString } from '../lib/date';
import { needsAttention, type AttentionItem } from '../lib/attention';
import { AttentionDetailModal } from './AttentionDetailModal';

const DISMISSED_STORAGE_KEY = 'fn_dismissed_attention_items_v1';

const KIND_ICONS = {
  stalled: TrendingDown,
  goal_deadline: Target,
  under_volume: Activity,
  neglected: Clock,
} as const;

const KIND_COLORS = {
  stalled: 'var(--danger)',
  goal_deadline: 'var(--accent)',
  under_volume: 'var(--primary)',
  neglected: 'var(--text-secondary-dark)',
} as const;

const readDismissedItems = (): Set<string> => {
  try {
    const value = JSON.parse(localStorage.getItem(DISMISSED_STORAGE_KEY) ?? '[]');
    return new Set(Array.isArray(value) ? value.filter(item => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
};

export function AttentionCard() {
  const { allLogs, exercises, goals, userUnit, settings, selectedDate } = useFitNotesStore();
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(readDismissedItems);
  const [openItem, setOpenItem] = useState<AttentionItem | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const items = useMemo(() => needsAttention({
    allLogs,
    exercises,
    goals,
    userUnit,
    firstDay: Math.max(0, Math.min(6, settings.first_day_of_week - 1)),
    requireComplete: settings.mark_sets_complete,
  }), [allLogs, exercises, goals, userUnit, settings.first_day_of_week, settings.mark_sets_complete]);

  const visibleItems = useMemo(() => items.filter(item => !dismissed.has(item.id)), [dismissed, items]);

  useEffect(() => {
    if (visibleItems.length === 0) return;
    setFocusedIndex(index => Math.min(index, visibleItems.length - 1));
  }, [visibleItems.length]);

  const focusItem = (index: number) => {
    if (visibleItems.length === 0) return;
    const next = (index + visibleItems.length) % visibleItems.length;
    setFocusedIndex(next);
    itemRefs.current[next]?.focus();
  };

  const dismiss = (item: AttentionItem, index = focusedIndex) => {
    const nextDismissed = new Set(dismissed).add(item.id);
    setDismissed(nextDismissed);
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...nextDismissed]));
    if (openItem?.id === item.id) setOpenItem(null);
    const remaining = visibleItems.length - 1;
    if (remaining > 0) {
      const nextIndex = Math.min(index, remaining - 1);
      setFocusedIndex(nextIndex);
      window.setTimeout(() => itemRefs.current[nextIndex]?.focus(), 0);
    }
  };

  const handleItemKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number, item: AttentionItem) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(index - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      setOpenItem(item);
    } else if (event.key.toLowerCase() === 'd') {
      event.preventDefault();
      dismiss(item, index);
    }
  };

  // Historical workout headers intentionally stay quiet.
  if (selectedDate < getLocalDateString() || visibleItems.length === 0) return null;

  return (
    <>
      <section
        className="card attention-card"
        aria-labelledby="needs-attention-title"
        style={{ gap: '10px', borderLeft: '4px solid var(--accent)', boxShadow: '0 10px 30px rgba(245, 158, 11, 0.08)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
          <div>
            <div id="needs-attention-title" className="card-title" style={{ margin: 0 }}>
              <AlertTriangle size={17} color="var(--accent)" /> Needs Attention
              <span style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', fontWeight: 700 }}>{visibleItems.length}</span>
            </div>
            {!collapsed && (
              <div style={{ color: 'var(--text-secondary-dark)', fontSize: '10px', marginTop: '4px' }}>
                Keyboard: ↑/↓ move · Enter open · D dismiss
              </div>
            )}
          </div>
          <button
            className="btn btn-secondary icon-btn"
            onClick={() => setCollapsed(value => !value)}
            aria-label={collapsed ? 'Expand needs attention' : 'Collapse needs attention'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
        {!collapsed && (
          <div role="list" aria-label="Items needing attention" style={{ display: 'flex', flexDirection: 'column' }}>
            {visibleItems.map((item, index) => {
              const Icon = KIND_ICONS[item.kind];
              return (
                <div
                  key={item.id}
                  role="listitem"
                  style={{
                    display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'stretch',
                    borderBottom: index < visibleItems.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  <button
                    ref={element => { itemRefs.current[index] = element; }}
                    tabIndex={index === focusedIndex ? 0 : -1}
                    onFocus={() => setFocusedIndex(index)}
                    onKeyDown={event => handleItemKeyDown(event, index, item)}
                    onClick={() => setOpenItem(item)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '10px', textAlign: 'left',
                      background: 'none', border: 'none', cursor: 'pointer', padding: '10px 8px 10px 0',
                      color: 'inherit', width: '100%', borderRadius: '8px',
                    }}
                  >
                    <Icon size={16} color={KIND_COLORS[item.kind]} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>
                      <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>{item.title}</span>
                      <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary-dark)', marginTop: '2px' }}>
                        {item.detail}
                      </span>
                    </span>
                  </button>
                  <button
                    className="btn icon-btn"
                    onClick={() => dismiss(item, index)}
                    aria-label={`Dismiss ${item.title}`}
                    title="Dismiss (D)"
                    style={{ alignSelf: 'center', color: 'var(--text-secondary-dark)', background: 'transparent', border: 'none' }}
                  >
                    <X size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {openItem && (
        <AttentionDetailModal
          item={openItem}
          onClose={() => setOpenItem(null)}
          onDismiss={() => dismiss(openItem, focusedIndex)}
        />
      )}
    </>
  );
}
