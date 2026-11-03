// MoreView.tsx - The phone's fifth tab: every destination without its own
// tab, grouped the same way as the desktop rail.
import { ChevronRight } from 'lucide-react';
import { NAV_GROUPS, APP_ITEMS, type NavItem } from '../components/AppNav';
import { SyncStatusChip } from '../components/SyncStatusChip';

const PHONE_TABS = new Set(['log', 'calendar', 'routines', 'body']);

const Row = ({ item }: { item: NavItem }) => {
  const Icon = item.icon;
  return (
    <a className="more-row" href={`#/${item.id}`}>
      <Icon size={22} aria-hidden />
      <span className="more-row-text">
        <span>{item.label}</span>
        <small>{item.hint}</small>
      </span>
      <ChevronRight size={18} aria-hidden className="more-row-chevron" />
    </a>
  );
};

export function MoreView() {
  const groups = [
    ...NAV_GROUPS.map(group => ({ title: group.title, items: group.items.filter(item => !PHONE_TABS.has(item.id)) })),
    { title: 'App', items: APP_ITEMS },
  ].filter(group => group.items.length > 0);

  return (
    <div className="more-view">
      <SyncStatusChip wide />
      {groups.map(group => (
        <section key={group.title} className="more-group" aria-labelledby={`more-${group.title}`}>
          <h2 id={`more-${group.title}`} className="section-title">{group.title}</h2>
          <div className="more-list">
            {group.items.map(item => <Row key={item.id} item={item} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
