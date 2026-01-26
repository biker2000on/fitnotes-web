'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { PRRecord } from '@/actions/progress';
import { PRBadge } from './pr-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { gramsToKg } from '@/lib/calculations';
import { Calendar } from 'lucide-react';

interface PRTimelineProps {
  prs: PRRecord[];
}

type PRType = 'max_weight' | 'max_reps' | 'max_volume' | 'max_1rm' | 'all';

export function PRTimeline({ prs }: PRTimelineProps) {
  const [filter, setFilter] = useState<PRType>('all');

  const filteredPRs = filter === 'all'
    ? prs
    : prs.filter(pr => pr.type === filter);

  const calculateImprovement = (pr: PRRecord): string => {
    if (pr.previousValue === 0) return 'First';
    const improvement = ((pr.value - pr.previousValue) / pr.previousValue) * 100;
    return `+${improvement.toFixed(1)}%`;
  };

  const formatValue = (pr: PRRecord): string => {
    switch (pr.type) {
      case 'max_weight':
        return `${gramsToKg(pr.value).toFixed(1)} kg`;
      case 'max_reps':
        return `${pr.value} reps`;
      case 'max_volume':
        return `${gramsToKg(pr.value).toFixed(0)} kg`;
      case 'max_1rm':
        return `${gramsToKg(pr.value).toFixed(1)} kg`;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>PR Timeline</span>
          <span className="text-sm text-muted-foreground font-normal">
            {filteredPRs.length} records
          </span>
        </CardTitle>
        <div className="flex gap-2 flex-wrap pt-2">
          <Badge
            variant={filter === 'all' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter('all')}
          >
            All
          </Badge>
          <Badge
            variant={filter === 'max_weight' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter('max_weight')}
          >
            Weight
          </Badge>
          <Badge
            variant={filter === 'max_reps' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter('max_reps')}
          >
            Reps
          </Badge>
          <Badge
            variant={filter === 'max_volume' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter('max_volume')}
          >
            Volume
          </Badge>
          <Badge
            variant={filter === 'max_1rm' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setFilter('max_1rm')}
          >
            1RM
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {filteredPRs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No personal records yet. Keep training!
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

            {/* Timeline items */}
            <div className="space-y-6">
              {filteredPRs.map((pr, index) => (
                <div key={index} className="relative flex gap-4">
                  {/* Timeline dot */}
                  <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-4 border-background bg-primary">
                    <Calendar className="h-5 w-5 text-primary-foreground" />
                  </div>

                  {/* PR content */}
                  <div className="flex-1 pt-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <PRBadge type={pr.type} />
                        <div className="text-2xl font-bold">{formatValue(pr)}</div>
                        <div className="text-sm text-muted-foreground">
                          {gramsToKg(pr.weight).toFixed(1)} kg × {pr.reps} reps
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(pr.date), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <Badge variant="secondary" className="whitespace-nowrap">
                        {calculateImprovement(pr)}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
