'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PercentageTable } from '@/components/tools/percentage-table';
import { formulas } from '@/lib/rm-formulas';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Header } from '@/components/layout/header';

export default function SetCalculatorPage() {
  const [oneRMInput, setOneRMInput] = useState<string>('');
  const [weight, setWeight] = useState<string>('');
  const [reps, setReps] = useState<string>('');
  const [oneRM, setOneRM] = useState<number | null>(null);
  const [rounded, setRounded] = useState(false);
  const [roundIncrement, setRoundIncrement] = useState<number>(2.5);
  const [inputMethod, setInputMethod] = useState<'direct' | 'calculate'>('direct');

  const handleCalculateFromDirect = () => {
    const value = parseFloat(oneRMInput);
    if (value && value > 0) {
      setOneRM(value);
    }
  };

  const handleCalculateFromReps = () => {
    const w = parseFloat(weight);
    const r = parseInt(reps);

    if (!w || !r || r < 1 || r > 12) {
      return;
    }

    // Use Epley formula as default
    const calculated = formulas.epley(w, r);
    setOneRM(calculated);
  };

  return (
    <div className="min-h-screen">
      <Header title="Set Calculator" />
      <div className="p-4 pb-24 space-y-6 max-w-2xl mx-auto">

      <Card>
        <CardHeader>
          <CardTitle>Enter Your 1RM</CardTitle>
          <CardDescription>
            Choose how you want to input your one-rep max
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={inputMethod} onValueChange={(v) => setInputMethod(v as 'direct' | 'calculate')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="direct">Enter 1RM Directly</TabsTrigger>
              <TabsTrigger value="calculate">Calculate from Weight & Reps</TabsTrigger>
            </TabsList>

            <TabsContent value="direct" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="oneRMInput">Your 1RM (kg)</Label>
                <Input
                  id="oneRMInput"
                  type="number"
                  placeholder="100"
                  value={oneRMInput}
                  onChange={(e) => setOneRMInput(e.target.value)}
                />
              </div>
              <Button onClick={handleCalculateFromDirect} className="w-full">
                Use This 1RM
              </Button>
            </TabsContent>

            <TabsContent value="calculate" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input
                    id="weight"
                    type="number"
                    placeholder="100"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reps">Reps</Label>
                  <Input
                    id="reps"
                    type="number"
                    placeholder="5"
                    min="1"
                    max="12"
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleCalculateFromReps} className="w-full">
                Calculate 1RM
              </Button>
            </TabsContent>
          </Tabs>

          {oneRM && (
            <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Current 1RM</p>
                <p className="text-3xl font-bold text-primary">{oneRM.toFixed(1)} kg</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {oneRM && (
        <Card>
          <CardHeader>
            <CardTitle>Training Weights</CardTitle>
            <CardDescription>
              Percentage-based weights for your training sessions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="rounded">Round Weights</Label>
                  <p className="text-sm text-muted-foreground">
                    Round to nearest plate increment
                  </p>
                </div>
                <Switch
                  id="rounded"
                  checked={rounded}
                  onCheckedChange={setRounded}
                />
              </div>

              {rounded && (
                <div className="space-y-2">
                  <Label>Round Increment</Label>
                  <RadioGroup
                    value={roundIncrement.toString()}
                    onValueChange={(v) => setRoundIncrement(parseFloat(v))}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="2.5" id="r2.5" />
                      <Label htmlFor="r2.5" className="font-normal">2.5 kg</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="5" id="r5" />
                      <Label htmlFor="r5" className="font-normal">5 kg</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="2" id="r2" />
                      <Label htmlFor="r2" className="font-normal">2 kg</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </div>

            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Click any weight to copy it to your clipboard
              </p>
              <PercentageTable
                oneRM={oneRM}
                unit="kg"
                rounded={rounded}
                roundIncrement={roundIncrement}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>How to Use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Percentage-Based Training</h4>
            <p className="text-sm text-muted-foreground">
              Training at different percentages of your 1RM targets different adaptations:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li><strong>85-100%</strong>: Maximum strength (1-5 reps)</li>
              <li><strong>70-85%</strong>: Strength and hypertrophy (6-10 reps)</li>
              <li><strong>60-70%</strong>: Hypertrophy and endurance (10-15 reps)</li>
              <li><strong>50-60%</strong>: Muscular endurance (15+ reps)</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Rounding Weights</h4>
            <p className="text-sm text-muted-foreground">
              Enable rounding to match the plates available at your gym. Most gyms have 2.5kg or 5lb increments.
            </p>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
