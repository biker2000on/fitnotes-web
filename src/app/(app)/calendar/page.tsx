'use client';

import { useState, useEffect, useTransition } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { MonthCalendar } from '@/components/calendar/month-calendar';
import { Button } from '@/components/ui/button';
import { getWorkoutDates } from '@/actions/trainingLogs';
import { History, Calendar } from 'lucide-react';

export default function CalendarPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [workoutDays, setWorkoutDays] = useState<{ date: string; categoryColors: string[] }[]>([]);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Load workout days for current view (3 months window)
    const start = format(subMonths(startOfMonth(selectedDate), 1), 'yyyy-MM-dd');
    const end = format(addMonths(endOfMonth(selectedDate), 1), 'yyyy-MM-dd');

    startTransition(async () => {
      const days = await getWorkoutDates(start, end);
      setWorkoutDays(days);
    });
  }, [selectedDate]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    // Navigate to workout page for that date
    router.push(`/workout?date=${format(date, 'yyyy-MM-dd')}`);
  };

  return (
    <div>
      <Header title="Calendar" />
      <div className="p-4 space-y-4">
        {/* View Toggle */}
        <div className="flex gap-2">
          <Button
            variant={view === 'calendar' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => setView('calendar')}
          >
            <Calendar className="mr-2 h-4 w-4" />
            Calendar
          </Button>
          <Button
            variant={view === 'list' ? 'default' : 'outline'}
            size="sm"
            className="flex-1"
            onClick={() => router.push('/calendar/history')}
          >
            <History className="mr-2 h-4 w-4" />
            History
          </Button>
        </div>

        {/* Calendar View */}
        <MonthCalendar
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          workoutDays={workoutDays}
        />
      </div>
    </div>
  );
}
