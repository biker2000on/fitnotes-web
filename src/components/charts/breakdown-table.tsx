'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DataRow {
  name: string;
  color: string;
  sets: number;
  reps: number;
  volume: number;
  percentage: number;
}

interface BreakdownTableProps {
  data: DataRow[];
  title: string;
  description?: string;
}

type SortKey = 'name' | 'sets' | 'reps' | 'volume' | 'percentage';
type SortDirection = 'asc' | 'desc';

export function BreakdownTable({ data, title, description }: BreakdownTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('volume');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortKey];
    const bValue = b[sortKey];

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });

  const SortButton = ({ column, label }: { column: SortKey; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => handleSort(column)}
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  );

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            No data available for the selected period
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortButton column="name" label="Name" />
              </TableHead>
              <TableHead className="text-right">
                <SortButton column="sets" label="Sets" />
              </TableHead>
              <TableHead className="text-right">
                <SortButton column="reps" label="Reps" />
              </TableHead>
              <TableHead className="text-right">
                <SortButton column="volume" label="Volume (kg)" />
              </TableHead>
              <TableHead className="text-right">
                <SortButton column="percentage" label="%" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedData.map((row, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="font-medium">{row.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">{row.sets}</TableCell>
                <TableCell className="text-right">{row.reps.toLocaleString()}</TableCell>
                <TableCell className="text-right">{row.volume.toLocaleString()}</TableCell>
                <TableCell className="text-right">{row.percentage.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
