'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RMTable } from '@/components/tools/rm-table';
import { formulas } from '@/lib/rm-formulas';
import { Header } from '@/components/layout/header';

export default function RMCalculatorPage() {
  const [weight, setWeight] = useState<string>('');
  const [reps, setReps] = useState<string>('');
  const [results, setResults] = useState<Record<string, number> | null>(null);

  const handleCalculate = () => {
    const w = parseFloat(weight);
    const r = parseInt(reps);

    if (!w || !r || r < 1 || r > 12) {
      return;
    }

    const calculated = {
      epley: formulas.epley(w, r),
      brzycki: formulas.brzycki(w, r),
      lombardi: formulas.lombardi(w, r),
      oconner: formulas.oconner(w, r),
      mayhew: formulas.mayhew(w, r),
    };

    setResults(calculated);
  };

  const average = results
    ? Object.values(results).reduce((sum, val) => sum + val, 0) / Object.values(results).length
    : 0;

  const formulaDescriptions: Record<string, string> = {
    epley: 'weight × (1 + reps/30)',
    brzycki: 'weight × (36 / (37 - reps))',
    lombardi: 'weight × reps^0.10',
    oconner: 'weight × (1 + reps/40)',
    mayhew: '(100 × weight) / (52.2 + 41.9 × e^(-0.055 × reps))',
  };

  return (
    <div className="min-h-screen">
      <Header title="1RM Calculator" />
      <div className="p-4 pb-24 space-y-6 max-w-2xl mx-auto">

      <Card>
        <CardHeader>
          <CardTitle>Calculate Your 1RM</CardTitle>
          <CardDescription>
            Enter the weight you lifted and the number of reps performed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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

          <Button onClick={handleCalculate} className="w-full">
            Calculate 1RM
          </Button>

          {results && (
            <div className="space-y-6 pt-4">
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Estimated 1RM Results</h3>
                <div className="grid gap-3">
                  {Object.entries(results).map(([formula, value]) => (
                    <div
                      key={formula}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <p className="font-medium capitalize">{formula}</p>
                        <p className="text-sm text-muted-foreground font-mono">
                          {formulaDescriptions[formula]}
                        </p>
                      </div>
                      <p className="text-2xl font-bold">{value.toFixed(1)} kg</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">Average 1RM</p>
                  <p className="text-3xl font-bold text-primary">{average.toFixed(1)} kg</p>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Taking the average of multiple formulas provides a more accurate estimate
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-3">Rep Max Table</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Based on your average 1RM of {average.toFixed(1)} kg
                </p>
                <RMTable oneRM={average} unit="kg" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About the Formulas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Epley Formula</h4>
            <p className="text-sm text-muted-foreground">
              One of the most widely used formulas. Works best for 4-10 reps.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Brzycki Formula</h4>
            <p className="text-sm text-muted-foreground">
              Commonly used in powerlifting. Most accurate for 2-10 reps.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Lombardi Formula</h4>
            <p className="text-sm text-muted-foreground">
              Based on exponential function. Good for lower rep ranges.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">O'Conner Formula</h4>
            <p className="text-sm text-muted-foreground">
              Conservative estimate. Works well for beginners.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">Mayhew Formula</h4>
            <p className="text-sm text-muted-foreground">
              Research-based formula using exponential decay. Good for higher reps.
            </p>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
