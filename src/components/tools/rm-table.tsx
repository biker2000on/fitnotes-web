'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calculateRepMax } from '@/lib/rm-formulas';

interface RMTableProps {
  oneRM: number;
  unit?: 'kg' | 'lbs';
}

export function RMTable({ oneRM, unit = 'kg' }: RMTableProps) {
  const repMaxes = Array.from({ length: 10 }, (_, i) => {
    const reps = i + 1;
    const weight = calculateRepMax(oneRM, reps);
    return { reps, weight };
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Reps</TableHead>
          <TableHead>Weight ({unit})</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {repMaxes.map(({ reps, weight }) => (
          <TableRow key={reps}>
            <TableCell className="font-medium">{reps}RM</TableCell>
            <TableCell>{weight.toFixed(1)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
