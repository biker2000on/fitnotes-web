'use client';

import { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WorkoutDay {
  date: string;
  categoryColors: string[];
}

interface MonthCalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  workoutDays: WorkoutDay[];
  firstDayOfWeek?: number; // 0 = Sunday, 1 = Monday
}

export function MonthCalendar({
  selectedDate,
  onDateSelect,
  workoutDays,
  firstDayOfWeek = 1,
}: MonthCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(selectedDate));

  const workoutMap = useMemo(() => {
    const map = new Map<string, string[]>();
    workoutDays.forEach(day => map.set(day.date, day.categoryColors));
    return map;
  }, [workoutDays]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: firstDayOfWeek as 0 | 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: firstDayOfWeek as 0 | 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth, firstDayOfWeek]);

  const dayNames = useMemo(() => {
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (firstDayOfWeek === 1) return [...names.slice(1), names[0]];
    return names;
  }, [firstDayOfWeek]);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
          <Button variant="outline" size="sm" onClick={() => {
            setCurrentMonth(startOfMonth(new Date()));
            onDateSelect(new Date());
          }}>
            Today
          </Button>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-2">
        {dayNames.map(name => (
          <div key={name} className="text-center text-sm font-medium text-muted-foreground py-2">
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const colors = workoutMap.get(dateStr) || [];
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={dateStr}
              onClick={() => onDateSelect(day)}
              className={cn(
                'relative aspect-square p-1 rounded-lg transition-colors flex flex-col items-center justify-center',
                'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
                !isCurrentMonth && 'text-muted-foreground/50',
                isSelected && 'bg-primary text-primary-foreground',
                isToday && !isSelected && 'ring-1 ring-primary'
              )}
            >
              <span className="text-sm">{format(day, 'd')}</span>
              {colors.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {colors.slice(0, 4).map((color, i) => (
                    <div
                      key={i}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
