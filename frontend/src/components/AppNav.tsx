// AppNav.tsx - Primary navigation. One set of destinations, two shapes:
// a bottom tab bar on phones (Log, Calendar, Routines, Body, More) and a
// grouped side rail from tablet width up. Items are real links into the
// hash router so they work with the keyboard, middle-click and Back.
import type { ComponentType } from 'react';
import {
  Dumbbell, CalendarDays, Layers3, Scale, Ellipsis, Flame, History,
  Ruler, Target, LineChart, Calculator, Settings, RefreshCw,
} from 'lucide-react';
import type { TabId } from '../store/slices/shared';
import { SyncStatusChip } from './SyncStatusChip';
import logoUrl from '../assets/logo.svg';

export interface NavItem {
  id: TabId;
  label: string;
  hint: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>;
}

export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Train',
    items: [
      { id: 'log', label: 'Log', hint: 'Today’s sets', icon: Dumbbell },
      { id: 'calendar', label: 'Calendar', hint: 'Every workout by month', icon: CalendarDays },
      { id: 'routines', label: 'Routines', hint: 'Your days and programs', icon: Layers3 },
      { id: 'exercises', label: 'Exercises', hint: 'Library, categories, records', icon: Flame },
      { id: 'history', label: 'History', hint: 'Workouts as a list', icon: History },
    ],
  },
  {
    title: 'Body',
    items: [
      { id: 'body', label: 'Body', hint: 'Weight and body fat', icon: Scale },
      { id: 'measurements', label: 'Measurements', hint: 'Waist, arms, and more', icon: Ruler },
      { id: 'goals', label: 'Goals', hint: 'Targets with dates', icon: Target },
    ],
  },
  {
    title: 'Insights',
    items: [
      { id: 'analysis', label: 'Analytics', hint: 'Strength, volume, consistency', icon: LineChart },
      { id: 'tools', label: 'Tools', hint: 'Plate and 1RM calculators', icon: Calculator },
    ],
  },
];

export const APP_ITEMS: NavItem[] = [
  { id: 'settings', label: 'Settings', hint: 'Units, theme, timers, data', icon: Settings },
  { id: 'sync', label: 'Account & sync', hint: 'Sign in, backups, import', icon: RefreshCw },
];

const PHONE_TABS: NavItem[] = [
  NAV_GROUPS[0].items[0],
  NAV_GROUPS[0].items[1],
  NAV_GROUPS[0].items[2],
  NAV_GROUPS[1].items[0],
  { id: 'more', label: 'More', hint: 'Everything else', icon: Ellipsis },
];

const PHONE_TAB_IDS = new Set<TabId>(['log', 'calendar', 'routines', 'body']);

// The routine editor lives under Routines; everything without its own phone
// tab lights up More.
export const navOwner = (tab: TabId): TabId => (tab === 'routine-editor' ? 'routines' : tab);
const phoneOwner = (tab: TabId): TabId => {
  const owner = navOwner(tab);
  return PHONE_TAB_IDS.has(owner) ? owner : 'more';
};

const NavLink = ({ item, active, compact }: { item: NavItem; active: boolean; compact?: boolean }) => {
  const Icon = item.icon;
  return (
    <a
      href={`#/${item.id}`}
      className={`nav-link${active ? ' is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      title={compact ? item.label : undefined}
    >
      <Icon size={20} strokeWidth={2} aria-hidden />
      <span className="nav-link-label">{item.label}</span>
    </a>
  );
};

export function AppNav({ activeTab }: { activeTab: TabId }) {
  const owner = navOwner(activeTab);
  const phoneActive = phoneOwner(activeTab);

  return (
    <>
      <nav className="side-rail" aria-label="Main">
        <a href="#/log" className="rail-brand" aria-label="FitNotes, go to today’s log">
          <img src={logoUrl} alt="" width={32} height={32} />
          <span className="rail-brand-name">FitNotes</span>
        </a>
        <div className="rail-groups">
          {NAV_GROUPS.map(group => (
            <div className="rail-group" key={group.title}>
              <div className="rail-group-title">{group.title}</div>
              {group.items.map(item => (
                <NavLink key={item.id} item={item} active={owner === item.id} compact />
              ))}
            </div>
          ))}
        </div>
        <div className="rail-footer">
          {APP_ITEMS.map(item => (
            <NavLink key={item.id} item={item} active={owner === item.id} compact />
          ))}
          <SyncStatusChip />
        </div>
      </nav>

      <nav className="tab-bar" aria-label="Main">
        {PHONE_TABS.map(item => (
          <NavLink key={item.id} item={item} active={phoneActive === item.id} />
        ))}
      </nav>
    </>
  );
}
