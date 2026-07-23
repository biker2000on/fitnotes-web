// SettingsView.tsx - Full user preferences, every setting drives real behavior.
import { useState, type ReactNode } from 'react';
import {
  BarChart3,
  ChevronDown,
  Dumbbell,
  Info,
  Keyboard,
  Palette,
  Plug,
  Settings as SettingsIcon,
  Timer,
} from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import type { Settings } from '../types';
import { ApiKeysPanel } from '../components/ApiKeysPanel';

export function SettingsView() {
  const {
    settings,
    updateSetting,
    withingsConnected,
    withingsLastSync,
    withingsSyncing,
    syncWithings,
    disconnectWithings,
    connectWithings
  } = useFitNotesStore();

  const Toggle = ({ k, label, hint }: { k: keyof Settings; label: string; hint?: string }) => (
    <Row label={label} hint={hint}>
      <button
        role="switch"
        aria-label={label}
        aria-checked={!!settings[k]}
        onClick={() => updateSetting(k, !settings[k] as any)}
        style={{
          width: '44px', height: '24px', borderRadius: '999px', border: 'none', cursor: 'pointer',
          background: settings[k] ? 'var(--primary)' : 'rgba(255,255,255,0.15)', position: 'relative', transition: 'background var(--transition-fast)',
        }}
      >
        <span style={{ position: 'absolute', top: '2px', left: settings[k] ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left var(--transition-fast)' }} />
      </button>
    </Row>
  );

  const Select = ({ k, label, options, hint }: { k: keyof Settings; label: string; options: [number, string][]; hint?: string }) => (
    <Row label={label} hint={hint}>
      <select className="settings-select" value={Number(settings[k])} onChange={e => updateSetting(k, Number(e.target.value) as any)} style={{ padding: '8px' }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Row>
  );

  const Num = ({ k, label, step = 1, hint }: { k: keyof Settings; label: string; step?: number; hint?: string }) => (
    <Row label={label} hint={hint}>
      <input className="settings-number" type="number" step={step} value={Number(settings[k])} onChange={e => updateSetting(k, Number(e.target.value) as any)} style={{ padding: '8px', textAlign: 'center' }} />
    </Row>
  );

  return (
    <div className="settings-page">
      <div className="card-title" style={{ margin: 0 }}><SettingsIcon size={18} /> Settings</div>

      <SettingsPanel
        title="Appearance & units"
        description="Theme, measurement units, calendar locale, and default increments"
        icon={<Palette size={18} />}
      >
        <Select k="app_theme_id" label="Theme" options={[[0, 'Dark'], [1, 'Light']]} />
        <Select k="metric" label="Unit System" options={[[1, 'Metric (kg)'], [0, 'Imperial (lbs)']]} />
        <Select k="distance_unit" label="Distance Unit" options={[[1, 'Kilometres (km)'], [2, 'Miles (mi)']]} />
        <Select k="first_day_of_week" label="First Day of Week" options={[[2, 'Monday'], [1, 'Sunday'], [7, 'Saturday']]} />
        <Num k="weight_increment" label="Default Weight Increment" step={0.25} />
      </SettingsPanel>

      <SettingsPanel
        title="Workout logging"
        description="Set entry, completion, personal records, and home-screen behavior"
        icon={<Dumbbell size={18} />}
      >
        <Toggle k="track_personal_records" label="Track Personal Records" hint="Highlight record sets and notify on new PRs" />
        <Toggle k="mark_sets_complete" label="Mark Sets Complete" hint="Show a checkbox next to each set" />
        <Toggle k="auto_select_next_set" label="Auto-Select Next Set" hint="Prefill the next set when using a routine or copying" />
        <Toggle k="keep_screen_on" label="Keep Screen On" hint="Prevent sleep while the workout log is open" />
        <Select k="home_screen_category_visibility_id" label="Category Visibility" options={[[0, "Don't show"], [1, 'Show name'], [2, 'Show name & colour']]} />
        <Toggle k="home_screen_skip_empty_dates" label="Skip Empty Dates" hint="Ignore days without workouts when swiping" />
      </SettingsPanel>

      <SettingsPanel
        title="Timers"
        description="Rest countdown alerts and automatic workout timing"
        icon={<Timer size={18} />}
      >
        <Num k="rest_timer_seconds" label="Rest Timer Duration (seconds)" />
        <Toggle k="rest_timer_auto_start" label="Auto-Start Rest Timer" hint="Start the timer automatically when a set is saved" />
        <Toggle k="rest_timer_sound" label="Rest Timer Sound" />
        <Toggle k="rest_timer_vibrate" label="Rest Timer Vibration" />
        <Num k="rest_timer_volume" label="Rest Timer Volume (%)" />
        <Toggle k="workout_timer_auto_start_enabled" label="Auto-Start Workout on First Set" />
        <Toggle k="workout_timer_auto_stop_enabled" label="Auto-Stop Workout on Last Set" />
      </SettingsPanel>

      <SettingsPanel
        title="Analysis & tracking"
        description="Estimated 1RM limits, graph presentation, calendar detail, and measurements"
        icon={<BarChart3 size={18} />}
      >
        <Num k="estimated_1rm_max_reps_to_include" label="e1RM Max Reps to Include" hint="Sets above this rep count are ignored (recommended 10-15)" />
        <Toggle k="estimated_1rm_max_apply_to_graph" label="Apply Rep Limit to Graph" />
        <Toggle k="graph_show_points" label="Show Graph Data Points" />
        <Toggle k="graph_show_trend_line" label="Show Graph Trend Line" />
        <Toggle k="graph_start_at_zero" label="Graph Y-Axis Starts at Zero" />
        <Toggle k="calendar_category_dots_visible" label="Calendar Category Dots" />
        <Toggle k="calendar_detail_visible" label="Calendar Workout Detail Panel" />
        <Toggle k="measurement_show_in_workout_log" label="Show in Workout Log" />
        <Toggle k="body_weight_show_in_workout_log" label="Show Body Weight in Workout Log" />
      </SettingsPanel>

      <SettingsPanel
        title="Integrations"
        description="Connected health services and API credentials"
        icon={<Plug size={18} />}
        mountOnOpen
      >
        <Row
          label="Withings Weight Sync"
          hint={
            withingsConnected
              ? `Status: Connected (Last sync: ${withingsLastSync ? new Date(withingsLastSync).toLocaleString() : 'Never'})`
              : "Connect your Withings Smart Scale to pull weight and body fat records automatically."
          }
        >
          {withingsConnected ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={syncWithings}
                disabled={withingsSyncing}
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                {withingsSyncing ? 'Syncing...' : 'Sync Now'}
              </button>
              <button
                className="btn"
                onClick={disconnectWithings}
                style={{ padding: '6px 12px', fontSize: '13px', backgroundColor: 'var(--accent)', color: '#fff', border: 'none' }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary"
              onClick={connectWithings}
              style={{ padding: '6px 12px', fontSize: '13px' }}
            >
              Connect Scale
            </button>
          )}
        </Row>
        <ApiKeysPanel />
      </SettingsPanel>

      <SettingsPanel
        title="Keyboard shortcuts"
        description="Navigation, logging, search, and modal commands"
        icon={<Keyboard size={18} />}
      >
        <Row 
          label="Go to Tab Chords (g followed by key within 1.5s)" 
          hint={
            <div style={{ marginTop: '4px', lineHeight: '1.5' }}>
              • l or w: Workout Log<br />
              • c: Calendar View<br />
              • e: Exercises<br />
              • r: Routines<br />
              • b: Body Weight<br />
              • m: Measurements<br />
              • g: Goals<br />
              • a: Analytics<br />
              • t: Tools<br />
              • s: Settings<br />
              • y: Sync Center
            </div>
          }
        >
          <span style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 'bold' }}>g + [key]</span>
        </Row>
        <Row label="Select Exercise Search Command Palette"><span style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>Ctrl + K</span></Row>
        <Row label="Save Active Set (always active)"><span style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>Ctrl + S</span></Row>
        <Row label="Toggle Plate Load Calculator Modal"><span style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>Ctrl + M</span></Row>
        <Row label="Load Last Logged Set Values into Inputs"><span style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>Ctrl + E</span></Row>
        <Row label="Date Shifts (when not typing)" hint="+ or =: Next day, - or _: Previous day, t: Jump to Today"><span style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>+, -, t</span></Row>
        <Row label="Calendar Month Shifts (when not typing)" hint="[: Shift calendar backwards one month, ]: Shift calendar forwards one month"><span style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>[, ]</span></Row>
        <Row label="Focus Search / Filter Field"><span style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>/</span></Row>
        <Row label="Exercise History Drawer" hint="1/2/3: History, Records, Graph tabs - m/y/a: graph range 1M/1Y/All - 0: reset zoom"><span style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>1-3, m, y, a, 0</span></Row>
        <Row label="Exercises Bulk Edit" hint="b: toggle bulk-edit mode - Ctrl+A: select all visible - Escape: exit"><span style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>b, Ctrl+A</span></Row>
        <Row label="Close Active Modals / Drawers"><span style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>Escape</span></Row>
        <Row label="Show Shortcut Reference Overlay"><span style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 'bold' }}>?</span></Row>
      </SettingsPanel>

      <SettingsPanel
        title="About"
        description="Application version and data-storage information"
        icon={<Info size={18} />}
      >
        <Row label="FitNotes Web/Tauri"><span style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>v1.0</span></Row>
        <Row label="Data" hint="Synced to your account (Postgres); offline-first on web & desktop"><span /></Row>
        <Row label="A faithful port of the FitNotes Android app"><span /></Row>
      </SettingsPanel>
    </div>
  );
}

function SettingsPanel({
  title,
  description,
  icon,
  mountOnOpen = false,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  mountOnOpen?: boolean;
  children: ReactNode;
}) {
  const [hasOpened, setHasOpened] = useState(!mountOnOpen);

  return (
    <details
      className="card settings-panel"
      onToggle={event => {
        if (event.currentTarget.open) setHasOpened(true);
      }}
    >
      <summary>
        <span style={{ color: 'var(--primary)', display: 'flex' }}>{icon}</span>
        <span className="settings-panel-heading">
          <span className="settings-panel-title">{title}</span>
          <span className="settings-panel-description">{description}</span>
        </span>
        <ChevronDown className="settings-panel-chevron" size={18} aria-hidden="true" />
      </summary>
      {hasOpened && <div className="settings-panel-content">{children}</div>}
    </details>
  );
}

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="settings-row">
      <div>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', marginTop: '2px' }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}
