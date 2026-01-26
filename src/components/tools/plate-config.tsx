'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Trash2, Plus } from 'lucide-react';
import { PlateConfig, formatWeight, parseWeight, getPlateColor } from '@/lib/plate-calculator';

interface PlateConfigEditorProps {
  plates: PlateConfig[];
  isMetric: boolean;
  onChange: (plates: PlateConfig[]) => void;
}

export function PlateConfigEditor({ plates, isMetric, onChange }: PlateConfigEditorProps) {
  const [newPlateWeight, setNewPlateWeight] = useState('');

  const handleUpdateCount = (index: number, count: number) => {
    const updated = [...plates];
    const currentPlate = updated[index];
    if (currentPlate) {
      updated[index] = { ...currentPlate, count: Math.max(0, count) };
      onChange(updated);
    }
  };

  const handleRemovePlate = (index: number) => {
    onChange(plates.filter((_, i) => i !== index));
  };

  const handleAddPlate = () => {
    const weight = parseFloat(newPlateWeight);
    if (isNaN(weight) || weight <= 0) return;

    const weightInGrams = parseWeight(weight, isMetric);
    const color = getPlateColor(weightInGrams, isMetric);

    onChange([
      ...plates,
      { weight: weightInGrams, count: 2, color }
    ]);

    setNewPlateWeight('');
  };

  return (
    <Card className="p-4 space-y-4">
      <div>
        <h3 className="font-medium mb-2">Available Plates</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configure the plates you have available
        </p>
      </div>

      <div className="space-y-2">
        {plates
          .sort((a, b) => b.weight - a.weight)
          .map((plate, index) => (
            <div key={index} className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded border border-border flex-shrink-0"
                style={{ backgroundColor: plate.color }}
              />
              <div className="flex-1">
                <span className="font-medium">{formatWeight(plate.weight, isMetric)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`count-${index}`} className="text-sm">
                  Count:
                </Label>
                <Input
                  id={`count-${index}`}
                  type="number"
                  min="0"
                  value={plate.count}
                  onChange={(e) => handleUpdateCount(index, parseInt(e.target.value) || 0)}
                  className="w-20"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemovePlate(index)}
                className="flex-shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
      </div>

      <div className="pt-4 border-t space-y-2">
        <Label htmlFor="new-plate">Add Custom Plate</Label>
        <div className="flex gap-2">
          <Input
            id="new-plate"
            type="number"
            placeholder={isMetric ? "Weight in kg" : "Weight in lbs"}
            value={newPlateWeight}
            onChange={(e) => setNewPlateWeight(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddPlate();
              }
            }}
          />
          <Button onClick={handleAddPlate} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
