// OverflowMenu.tsx - A "more actions" button with a small menu. Keeps rare or
// destructive actions out of the way without hiding them.
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { EllipsisVertical } from 'lucide-react';

export interface OverflowItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  tone?: 'danger';
}

export function OverflowMenu({ items, label = 'More actions' }: { items: OverflowItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', onKey);
    rootRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const buttons = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = e.key === 'ArrowDown' ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  return (
    <div className="overflow-menu" ref={rootRef}>
      <button
        type="button"
        className="icon-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen(v => !v)}
      >
        <EllipsisVertical size={20} aria-hidden />
      </button>
      {open && (
        <div className="overflow-menu-list" role="menu" id={menuId} onKeyDown={onMenuKey}>
          {items.map(item => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`overflow-menu-item${item.tone === 'danger' ? ' is-danger' : ''}`}
              onClick={() => { setOpen(false); item.onSelect(); }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
