'use client';

import { formatWeight } from '@/lib/plate-calculator';

interface PlateDisplayProps {
  plates: { weight: number; count: number; color: string }[];
  achievedWeight: number;
  targetWeight: number;
  barWeight: number;
  remainder: number;
  isMetric: boolean;
}

export function PlateDisplay({
  plates,
  achievedWeight,
  targetWeight,
  barWeight,
  remainder,
  isMetric
}: PlateDisplayProps) {
  if (plates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Enter a target weight above the bar weight</p>
      </div>
    );
  }

  const barColor = '#78716c'; // stone-500

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-4 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground">Target Weight</div>
          <div className="text-xl font-bold">{formatWeight(targetWeight, isMetric)}</div>
        </div>
        <div className="text-center p-4 bg-muted rounded-lg">
          <div className="text-sm text-muted-foreground">Achieved Weight</div>
          <div className="text-xl font-bold">{formatWeight(achievedWeight, isMetric)}</div>
        </div>
      </div>

      {remainder > 0 && (
        <div className="text-center text-sm text-amber-600 dark:text-amber-400">
          Unable to add {formatWeight(remainder, isMetric)} with available plates
        </div>
      )}

      {/* Visual Plate Display */}
      <div className="relative">
        {/* Bar */}
        <div className="flex items-center justify-center gap-2 py-8">
          {/* Left plates (reversed order) */}
          <div className="flex items-center gap-1">
            {plates.slice().reverse().map((plate, index) => (
              <div key={`left-${index}`} className="flex gap-0.5">
                {Array.from({ length: plate.count }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-sm border border-border"
                    style={{
                      backgroundColor: plate.color,
                      width: `${Math.max(8, Math.min(32, Math.sqrt(plate.weight / 1000) * 4))}px`,
                      height: `${Math.max(48, Math.min(120, Math.sqrt(plate.weight / 1000) * 12))}px`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Barbell */}
          <div
            className="rounded-sm border border-border flex items-center justify-center"
            style={{
              backgroundColor: barColor,
              width: '120px',
              height: '24px',
            }}
          >
            <span className="text-xs font-medium text-white">
              {formatWeight(barWeight, isMetric)}
            </span>
          </div>

          {/* Right plates */}
          <div className="flex items-center gap-1">
            {plates.map((plate, index) => (
              <div key={`right-${index}`} className="flex gap-0.5">
                {Array.from({ length: plate.count }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-sm border border-border"
                    style={{
                      backgroundColor: plate.color,
                      width: `${Math.max(8, Math.min(32, Math.sqrt(plate.weight / 1000) * 4))}px`,
                      height: `${Math.max(48, Math.min(120, Math.sqrt(plate.weight / 1000) * 12))}px`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plate Breakdown */}
      <div className="space-y-2">
        <h3 className="font-medium text-sm">Plates per side:</h3>
        <div className="space-y-1">
          {plates.map((plate, index) => (
            <div key={index} className="flex items-center gap-3 text-sm">
              <div
                className="w-6 h-6 rounded border border-border"
                style={{ backgroundColor: plate.color }}
              />
              <div className="flex-1">
                <span className="font-medium">{plate.count}x</span>{' '}
                {formatWeight(plate.weight, isMetric)}
              </div>
              <div className="text-muted-foreground">
                = {formatWeight(plate.weight * plate.count, isMetric)}
              </div>
            </div>
          ))}
        </div>
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Total per side:</span>
            <span>{formatWeight((achievedWeight - barWeight) / 2, isMetric)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
