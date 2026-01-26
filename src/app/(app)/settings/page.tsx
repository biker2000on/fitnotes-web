'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { SettingsSection } from '@/components/settings/settings-section';
import { SettingRow } from '@/components/settings/setting-row';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getUserSettings, updateUserSettings } from '@/actions/userSettings';
import { Dumbbell, Timer, Monitor, User, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { ThemeSelector } from '@/components/theme-selector';

export default function SettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await getUserSettings();
      setSettings(data);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  async function updateSetting(key: string, value: any) {
    try {
      const updated = await updateUserSettings({ [key]: value });
      setSettings(updated);
      toast.success('Settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
    }
  }

  if (loading || !settings) {
    return (
      <div>
        <Header title="Settings" />
        <div className="p-4">Loading...</div>
      </div>
    );
  }

  const weightIncrements = settings.metric
    ? [
        { label: '1.25 kg', value: 1250 },
        { label: '2.5 kg', value: 2500 },
        { label: '5 kg', value: 5000 },
      ]
    : [
        { label: '2.5 lbs', value: 1134 },
        { label: '5 lbs', value: 2268 },
        { label: '10 lbs', value: 4536 },
      ];

  return (
    <div>
      <Header title="Settings" />
      <div className="p-4 space-y-4">
        {/* Units Section */}
        <SettingsSection title="Units" icon={Scale}>
          <SettingRow
            label="Use Metric System"
            description="Display weights in kilograms"
          >
            <Switch
              checked={settings.metric}
              onCheckedChange={(checked) => updateSetting('metric', checked)}
            />
          </SettingRow>
          <SettingRow
            label="Weight Increment"
            description="Default weight increment for exercises"
          >
            <Select
              value={settings.weightIncrement.toString()}
              onValueChange={(value) => updateSetting('weightIncrement', parseInt(value))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {weightIncrements.map((inc) => (
                  <SelectItem key={inc.value} value={inc.value.toString()}>
                    {inc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
          <SettingRow
            label="First Day of Week"
            description="Calendar week starts on"
          >
            <Select
              value={settings.firstDayOfWeek.toString()}
              onValueChange={(value) => updateSetting('firstDayOfWeek', parseInt(value))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Sunday</SelectItem>
                <SelectItem value="2">Monday</SelectItem>
              </SelectContent>
            </Select>
          </SettingRow>
        </SettingsSection>

        {/* Workout Section */}
        <SettingsSection title="Workout" icon={Dumbbell}>
          <SettingRow
            label="Track Personal Records"
            description="Highlight new PRs during workouts"
          >
            <Switch
              checked={settings.trackPersonalRecords}
              onCheckedChange={(checked) => updateSetting('trackPersonalRecords', checked)}
            />
          </SettingRow>
          <SettingRow
            label="Mark Sets Complete"
            description="Track completion status for each set"
          >
            <Switch
              checked={settings.markSetsComplete}
              onCheckedChange={(checked) => updateSetting('markSetsComplete', checked)}
            />
          </SettingRow>
          <SettingRow
            label="Auto-select Next Set"
            description="Automatically select the next set after completing one"
          >
            <Switch
              checked={settings.autoSelectNextSet}
              onCheckedChange={(checked) => updateSetting('autoSelectNextSet', checked)}
            />
          </SettingRow>
          <SettingRow
            label="Keep Screen On"
            description="Prevent screen from dimming during workouts"
          >
            <Switch
              checked={settings.keepScreenOn}
              onCheckedChange={(checked) => updateSetting('keepScreenOn', checked)}
            />
          </SettingRow>
        </SettingsSection>

        {/* Timer Section */}
        <SettingsSection title="Rest Timer" icon={Timer}>
          <SettingRow
            label="Default Rest Time"
            description="Seconds"
          >
            <Input
              type="number"
              min="0"
              max="600"
              value={settings.restTimerSeconds}
              onChange={(e) => updateSetting('restTimerSeconds', parseInt(e.target.value) || 0)}
              className="w-24"
            />
          </SettingRow>
          <SettingRow
            label="Auto-start Timer"
            description="Start rest timer automatically after completing a set"
          >
            <Switch
              checked={settings.restTimerAutoStart}
              onCheckedChange={(checked) => updateSetting('restTimerAutoStart', checked)}
            />
          </SettingRow>
          <SettingRow
            label="Timer Sound"
            description="Play sound when rest timer completes"
          >
            <Switch
              checked={settings.restTimerSound}
              onCheckedChange={(checked) => updateSetting('restTimerSound', checked)}
            />
          </SettingRow>
          <SettingRow
            label="Timer Vibrate"
            description="Vibrate when rest timer completes"
          >
            <Switch
              checked={settings.restTimerVibrate}
              onCheckedChange={(checked) => updateSetting('restTimerVibrate', checked)}
            />
          </SettingRow>
        </SettingsSection>

        {/* Display Section */}
        <SettingsSection title="Display" icon={Monitor}>
          <SettingRow
            label="Theme"
            description="Light, dark, or system default"
          >
            <ThemeSelector />
          </SettingRow>
          <SettingRow
            label="Show Graph Points"
            description="Display data points on progress graphs"
          >
            <Switch
              checked={settings.graphShowPoints}
              onCheckedChange={(checked) => updateSetting('graphShowPoints', checked)}
            />
          </SettingRow>
          <SettingRow
            label="Show Trend Line"
            description="Display trend line on progress graphs"
          >
            <Switch
              checked={settings.graphShowTrendLine}
              onCheckedChange={(checked) => updateSetting('graphShowTrendLine', checked)}
            />
          </SettingRow>
        </SettingsSection>

        {/* Account Section */}
        <SettingsSection title="Account" icon={User}>
          <SettingRow label="Change Password" description="Update your account password">
            <Button variant="outline" size="sm">Change</Button>
          </SettingRow>
          <SettingRow label="Logout" description="Sign out of your account">
            <Button variant="outline" size="sm">Logout</Button>
          </SettingRow>
          <SettingRow label="Delete Account" description="Permanently delete your account and all data">
            <Button variant="destructive" size="sm">Delete</Button>
          </SettingRow>
        </SettingsSection>
      </div>
    </div>
  );
}
