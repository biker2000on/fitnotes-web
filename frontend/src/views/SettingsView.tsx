// SettingsView.tsx - Full user preferences, every setting drives real behavior.
import type { ReactNode } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { useFitNotesStore } from '../store/FitNotesStore';
import type { Settings } from '../types';

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
      <select value={Number(settings[k])} onChange={e => updateSetting(k, Number(e.target.value) as any)} style={{ width: '180px', padding: '8px' }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Row>
  );

  const Num = ({ k, label, step = 1, hint }: { k: keyof Settings; label: string; step?: number; hint?: string }) => (
    <Row label={label} hint={hint}>
      <input type="number" step={step} value={Number(settings[k])} onChange={e => updateSetting(k, Number(e.target.value) as any)} style={{ width: '120px', padding: '8px', textAlign: 'center' }} />
    </Row>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '720px', margin: '0 auto', width: '100%' }}>
      <div className="card-title" style={{ margin: 0 }}><SettingsIcon size={18} /> Settings</div>

      <Section title="General">
        <Select k="app_theme_id" label="Theme" options={[[0, 'Dark'], [1, 'Light']]} />
        <Select k="metric" label="Unit System" options={[[1, 'Metric (kg)'], [0, 'Imperial (lbs)']]} />
        <Select k="distance_unit" label="Distance Unit" options={[[1, 'Kilometres (km)'], [2, 'Miles (mi)']]} />
        <Select k="first_day_of_week" label="First Day of Week" options={[[2, 'Monday'], [1, 'Sunday'], [7, 'Saturday']]} />
        <Num k="weight_increment" label="Default Weight Increment" step={0.25} />
      </Section>

      <Section title="Workout">
        <Toggle k="track_personal_records" label="Track Personal Records" hint="Highlight record sets and notify on new PRs" />
        <Toggle k="mark_sets_complete" label="Mark Sets Complete" hint="Show a checkbox next to each set" />
        <Toggle k="auto_select_next_set" label="Auto-Select Next Set" hint="Prefill the next set when using a routine or copying" />
        <Toggle k="keep_screen_on" label="Keep Screen On" hint="Prevent sleep while the workout log is open" />
      </Section>

      <Section title="Rest Timer">
        <Num k="rest_timer_seconds" label="Default Duration (seconds)" />
        <Toggle k="rest_timer_auto_start" label="Auto-Start" hint="Start the timer automatically when a set is saved" />
        <Toggle k="rest_timer_sound" label="Sound" />
        <Toggle k="rest_timer_vibrate" label="Vibrate" />
        <Num k="rest_timer_volume" label="Volume (%)" />
      </Section>

      <Section title="Workout Timer">
        <Toggle k="workout_timer_auto_start_enabled" label="Auto-Start on First Set" />
        <Toggle k="workout_timer_auto_stop_enabled" label="Auto-Stop on Last Set" />
      </Section>

      <Section title="Estimated 1RM">
        <Num k="estimated_1rm_max_reps_to_include" label="Max Reps to Include" hint="Sets above this rep count are ignored (recommended 10-15)" />
        <Toggle k="estimated_1rm_max_apply_to_graph" label="Apply Rep Limit to Graph" />
      </Section>

      <Section title="Graphs">
        <Toggle k="graph_show_points" label="Show Data Points" />
        <Toggle k="graph_show_trend_line" label="Show Trend Line" />
        <Toggle k="graph_start_at_zero" label="Y-Axis Starts at Zero" />
      </Section>

      <Section title="Calendar">
        <Toggle k="calendar_category_dots_visible" label="Category Dots" />
        <Toggle k="calendar_detail_visible" label="Workout Detail Panel" />
      </Section>

      <Section title="Home Screen">
        <Select k="home_screen_category_visibility_id" label="Category Visibility" options={[[0, "Don't show"], [1, 'Show name'], [2, 'Show name & colour']]} />
        <Toggle k="home_screen_skip_empty_dates" label="Skip Empty Dates" hint="Ignore days without workouts when swiping" />
      </Section>

      <Section title="Measurements">
        <Toggle k="measurement_show_in_workout_log" label="Show in Workout Log" />
        <Toggle k="body_weight_show_in_workout_log" label="Show Body Weight in Workout Log" />
      </Section>

      <Section title="Integrations">
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
      </Section>

      <Section title="Keyboard Shortcuts">
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
        <Row label="Close Active Modals / Drawers"><span style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>Escape</span></Row>
      </Section>

      <Section title="About">
        <Row label="FitNotes Web/Tauri"><span style={{ fontSize: '13px', color: 'var(--text-secondary-dark)' }}>v1.0</span></Row>
        <Row label="Data" hint="Synced to your account (Postgres); offline-first on web & desktop"><span /></Row>
        <Row label="A faithful port of the FitNotes Android app"><span /></Row>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card" style={{ gap: '4px' }}>
      <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>{label}</div>
        {hint && <div style={{ fontSize: '11px', color: 'var(--text-secondary-dark)', marginTop: '2px' }}>{hint}</div>}
      </div>
      <div style={{ flexShrink: 0 }}>{children}</div>
    </div>
  );
}
