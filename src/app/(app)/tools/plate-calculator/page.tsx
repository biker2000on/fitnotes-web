'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PlateDisplay } from '@/components/tools/plate-display';
import { PlateConfigEditor } from '@/components/tools/plate-config';
import {
  calculatePlates,
  getDefaultPlateSet,
  parseWeight,
  PlateConfig,
  PlateResult
} from '@/lib/plate-calculator';
import { Settings } from 'lucide-react';

const STORAGE_KEY = 'plate-calculator-config';

interface StoredConfig {
  isMetric: boolean;
  barWeight: number;
  customPlates?: PlateConfig[];
}

export default function PlateCalculatorPage() {
  const [isMetric, setIsMetric] = useState(true);
  const [targetWeight, setTargetWeight] = useState('');
  const [barType, setBarType] = useState<'20kg' | '15kg' | 'custom'>('20kg');
  const [customBarWeight, setCustomBarWeight] = useState('');
  const [availablePlates, setAvailablePlates] = useState<PlateConfig[]>([]);
  const [result, setResult] = useState<PlateResult | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // Load saved config
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const config: StoredConfig = JSON.parse(stored);
        setIsMetric(config.isMetric);
        if (config.customPlates) {
          setAvailablePlates(config.customPlates);
        } else {
          setAvailablePlates(getDefaultPlateSet(config.isMetric));
        }
      } catch {
        setAvailablePlates(getDefaultPlateSet(true));
      }
    } else {
      setAvailablePlates(getDefaultPlateSet(true));
    }
  }, []);

  // Save config
  useEffect(() => {
    const config: StoredConfig = {
      isMetric,
      barWeight: getBarWeight(),
      customPlates: availablePlates
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }, [isMetric, availablePlates, barType, customBarWeight]);

  // Update plates when metric changes
  const handleMetricToggle = (checked: boolean) => {
    setIsMetric(checked);
    setAvailablePlates(getDefaultPlateSet(checked));
    setTargetWeight('');
    setCustomBarWeight('');
  };

  const getBarWeight = (): number => {
    if (barType === '20kg') {
      return isMetric ? 20000 : 20412; // 20kg or 45lbs
    } else if (barType === '15kg') {
      return isMetric ? 15000 : 15876; // 15kg or 35lbs
    } else {
      const weight = parseFloat(customBarWeight) || 0;
      return parseWeight(weight, isMetric);
    }
  };

  const handleCalculate = () => {
    const target = parseFloat(targetWeight);
    if (isNaN(target) || target <= 0) return;

    const targetInGrams = parseWeight(target, isMetric);
    const barInGrams = getBarWeight();

    const calculationResult = calculatePlates(
      targetInGrams,
      barInGrams,
      availablePlates
    );

    setResult(calculationResult);
  };

  return (
    <div className="min-h-screen">
      <Header title="Plate Calculator" />
      <div className="p-4 pb-24 space-y-6 max-w-2xl mx-auto">
        {/* Unit Toggle */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="metric-toggle">Units</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm">Imperial (lbs)</span>
              <Switch
                id="metric-toggle"
                checked={isMetric}
                onCheckedChange={handleMetricToggle}
              />
              <span className="text-sm">Metric (kg)</span>
            </div>
          </div>
        </Card>

        {/* Calculator Inputs */}
        <Card className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target-weight">Target Weight</Label>
            <div className="flex gap-2">
              <Input
                id="target-weight"
                type="number"
                placeholder={isMetric ? "100" : "220"}
                value={targetWeight}
                onChange={(e) => setTargetWeight(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCalculate();
                  }
                }}
              />
              <span className="flex items-center text-sm text-muted-foreground">
                {isMetric ? 'kg' : 'lbs'}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bar-type">Bar Weight</Label>
            <Select value={barType} onValueChange={(value: any) => setBarType(value)}>
              <SelectTrigger id="bar-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="20kg">
                  {isMetric ? '20 kg' : '45 lbs'} (Standard Olympic)
                </SelectItem>
                <SelectItem value="15kg">
                  {isMetric ? '15 kg' : '35 lbs'} (Women\'s Olympic)
                </SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            {barType === 'custom' && (
              <Input
                type="number"
                placeholder={isMetric ? "Bar weight in kg" : "Bar weight in lbs"}
                value={customBarWeight}
                onChange={(e) => setCustomBarWeight(e.target.value)}
              />
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCalculate} className="flex-1">
              Calculate
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowConfig(!showConfig)}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        {/* Plate Configuration */}
        {showConfig && (
          <PlateConfigEditor
            plates={availablePlates}
            isMetric={isMetric}
            onChange={setAvailablePlates}
          />
        )}

        {/* Results */}
        {result && (
          <Card className="p-4">
            <PlateDisplay
              plates={result.plates}
              achievedWeight={result.achievedWeight}
              targetWeight={parseWeight(parseFloat(targetWeight), isMetric)}
              barWeight={getBarWeight()}
              remainder={result.remainder}
              isMetric={isMetric}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
