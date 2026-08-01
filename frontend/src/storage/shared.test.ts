import { describe, expect, it } from 'vitest';
import { buildShorthandStatements, parseSettingsValue, settingsFromKeyValueRows } from './shared';

describe('parseSettingsValue', () => {
  it('parses booleans and numbers', () => {
    expect(parseSettingsValue('true')).toBe(true);
    expect(parseSettingsValue('false')).toBe(false);
    expect(parseSettingsValue('2.5')).toBe(2.5);
    expect(parseSettingsValue('0')).toBe(0);
  });

  it('maps stringified nulls back to real null', () => {
    // The key-value store writes String(null) === "null"; pushing that string
    // into a numeric-nullable sync field 400s the Go decoder.
    expect(parseSettingsValue('null')).toBeNull();
    expect(parseSettingsValue('undefined')).toBeNull();
    expect(parseSettingsValue('')).toBeNull();
  });
});

describe('settings type coercion', () => {
  it('coerces bool settings stored as numbers back to booleans', () => {
    // Legacy/migrated stores hold metric as "1"; Go's decoder requires a bool.
    const settings = settingsFromKeyValueRows([
      { key: 'metric', value: '1' },
      { key: 'track_personal_records', value: '0' },
      { key: 'rest_timer_seconds', value: '90' },
    ]);
    expect(settings.metric).toBe(true);
    expect(settings.track_personal_records).toBe(false);
    expect(settings.rest_timer_seconds).toBe(90);
  });
});

describe('settings null round-trip', () => {
  it('a null setting written through shorthand syncs as null, not "null"', () => {
    const statements = buildShorthandStatements('UPDATE settings', [{ body_weight_goal_weight: null }])!;
    const write = statements.find(s => s.params[0] === 'body_weight_goal_weight')!;
    expect(write.params[1]).toBe('null'); // stored stringified (historic format)

    const settings = settingsFromKeyValueRows([{ key: 'body_weight_goal_weight', value: write.params[1] }]);
    expect(settings.body_weight_goal_weight).toBeNull(); // but read back as real null
  });
});

describe('routine template set shorthand', () => {
  const templateSet = {
    id: 'set-1',
    routine_section_exercise_id: 'rse-1',
    metric_weight: 100,
    reps: 8,
    sort_order: 1,
  };

  it('expands an INSERT for a table whose name contains "sets"', () => {
    const statements = buildShorthandStatements('INSERT INTO routine_section_exercise_sets', [templateSet]);

    expect(statements).toHaveLength(1);
    expect(statements![0].sql).toMatch(/^INSERT OR REPLACE INTO routine_section_exercise_sets \(/);
    expect(statements![0].params).toContain('set-1');
  });

  it('expands an UPDATE for a table whose name contains "sets"', () => {
    const statements = buildShorthandStatements('UPDATE routine_section_exercise_sets', [templateSet]);

    expect(statements).toHaveLength(1);
    expect(statements![0].sql).toMatch(/^UPDATE routine_section_exercise_sets SET /);
    expect(statements![0].params[statements![0].params.length - 1]).toBe('set-1');
  });
});
