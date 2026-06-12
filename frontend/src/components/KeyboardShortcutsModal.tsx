// KeyboardShortcutsModal.tsx - Global "?" shortcut reference overlay.
// Grouped, scannable cheat sheet rendered with consistent <kbd> keycaps.
import { Keyboard, X } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';

interface ShortcutRow {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  rows: ShortcutRow[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Global',
    rows: [
      { keys: ['?'], description: 'Toggle this shortcut reference' },
      { keys: ['/'], description: 'Focus the search / filter field' },
      { keys: ['Ctrl', 'K'], description: 'Exercise command palette' },
      { keys: ['Esc'], description: 'Close any modal or drawer' },
    ],
  },
  {
    title: 'Navigation (press g, then a key)',
    rows: [
      { keys: ['g', 'l'], description: 'Workout Log' },
      { keys: ['g', 'c'], description: 'Calendar' },
      { keys: ['g', 'e'], description: 'Exercises' },
      { keys: ['g', 'r'], description: 'Routines' },
      { keys: ['g', 'b'], description: 'Body Weight' },
      { keys: ['g', 'm'], description: 'Measurements' },
      { keys: ['g', 'g'], description: 'Goals' },
      { keys: ['g', 'a'], description: 'Analytics' },
      { keys: ['g', 't'], description: 'Tools' },
      { keys: ['g', 's'], description: 'Settings' },
      { keys: ['g', 'y'], description: 'Sync Center' },
    ],
  },
  {
    title: 'Logging',
    rows: [
      { keys: ['Ctrl', 'S'], description: 'Save the active set' },
      { keys: ['Ctrl', 'E'], description: 'Load last logged values into inputs' },
      { keys: ['Ctrl', 'M'], description: 'Plate calculator' },
      { keys: ['Enter'], description: 'Save set (while in a logging field)' },
      { keys: ['+', '-'], description: 'Step value (while in a logging field)' },
    ],
  },
  {
    title: 'Dates',
    rows: [
      { keys: ['+'], description: 'Next day' },
      { keys: ['-'], description: 'Previous day' },
      { keys: ['t'], description: 'Jump to today' },
      { keys: ['['], description: 'Calendar back one month' },
      { keys: [']'], description: 'Calendar forward one month' },
    ],
  },
  {
    title: 'Exercise History Drawer',
    rows: [
      { keys: ['1'], description: 'History tab' },
      { keys: ['2'], description: 'Records tab' },
      { keys: ['3'], description: 'Graph tab' },
      { keys: ['m'], description: 'Graph range: 1 month' },
      { keys: ['y'], description: 'Graph range: 1 year' },
      { keys: ['a'], description: 'Graph range: all time' },
      { keys: ['0'], description: 'Reset graph zoom' },
    ],
  },
  {
    title: 'Exercises: Bulk Edit',
    rows: [
      { keys: ['b'], description: 'Toggle bulk-edit mode' },
      { keys: ['Ctrl', 'A'], description: 'Select all visible (in bulk mode)' },
      { keys: ['Esc'], description: 'Exit bulk-edit mode' },
    ],
  },
];

export function KeyboardShortcutsModal() {
  const { showShortcutsHelp, setShowShortcutsHelp } = useFitNotesStore();

  if (!showShortcutsHelp) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 100010 }} onClick={() => setShowShortcutsHelp(false)}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '760px', width: 'min(760px, calc(100vw - 32px))', maxHeight: '85dvh', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Keyboard size={20} color="var(--primary)" /> Keyboard Shortcuts
          </h2>
          <button className="icon-btn" onClick={() => setShowShortcutsHelp(false)} aria-label="Close shortcuts">
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px 32px', marginTop: '8px' }}>
          {GROUPS.map(group => (
            <div key={group.title}>
              <div style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--primary)', marginBottom: '8px' }}>
                {group.title}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {group.rows.map(row => (
                  <div key={row.description} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '5px 0', borderBottom: '1px solid rgba(128,128,128,0.08)' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>{row.description}</span>
                    <span style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      {row.keys.map((k, i) => <kbd key={i} className="kbd">{k}</kbd>)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', marginTop: '16px', textAlign: 'center' }}>
          Single-key shortcuts pause automatically while you type in a field.
        </p>
      </div>
    </div>
  );
}
