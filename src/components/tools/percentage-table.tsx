'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { calculatePercentage, roundToNearest, suggestedRepsForPercentage } from '@/lib/rm-formulas';
import { Copy, Check } from 'lucide-react';

interface PercentageTableProps {
  oneRM: number;
  unit?: 'kg' | 'lbs';
  rounded?: boolean;
  roundIncrement?: number;
}

export function PercentageTable({ oneRM, unit = 'kg', rounded = false, roundIncrement = 2.5 }: PercentageTableProps) {
  const [copiedPercentage, setCopiedPercentage] = useState<number | null>(null);

  const percentages = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50];

  const handleCopy = async (weight: number, percentage: number) => {
    await navigator.clipboard.writeText(weight.toFixed(1));
    setCopiedPercentage(percentage);
    setTimeout(() => setCopiedPercentage(null), 2000);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">%</TableHead>
          <TableHead>Weight ({unit})</TableHead>
          <TableHead>Suggested Reps</TableHead>
          <TableHead className="w-16"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {percentages.map((percentage) => {
          let weight = calculatePercentage(oneRM, percentage);
          if (rounded) {
            weight = roundToNearest(weight, roundIncrement);
          }
          const suggestedReps = suggestedRepsForPercentage[percentage] || '-';

          return (
            <TableRow key={percentage}>
              <TableCell className="font-medium">{percentage}%</TableCell>
              <TableCell className="font-mono">{weight.toFixed(1)}</TableCell>
              <TableCell className="text-muted-foreground">{suggestedReps}</TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(weight, percentage)}
                  className="h-8 w-8 p-0"
                >
                  {copiedPercentage === percentage ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
