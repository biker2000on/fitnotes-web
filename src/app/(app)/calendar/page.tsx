'use client';

import { useState, useEffect, useTransition } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { MonthCalendar } from '@/components/calendar/month-calendar';
import { getWorkoutDates } from '@/actions/trainingLogs';

export default function CalendarPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [workoutDays, setWorkoutDays] = useState<{ date: string; categoryColors: string[] }[]>([]);
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
      <div className="p-4">
        <MonthCalendar
          selectedDate={selectedDate}
          onDateSelect={handleDateSelect}
          workoutDays={workoutDays}
        />
      </div>
    </div>
  );
}
