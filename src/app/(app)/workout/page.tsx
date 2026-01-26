'use client';

import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { addDays, subDays } from 'date-fns';

export default function WorkoutPage() {
  const [date, setDate] = useState(new Date());

  return (
    <div>
      <Header
        showDateNav
        date={date}
        onPrevDate={() => setDate(subDays(date, 1))}
        onNextDate={() => setDate(addDays(date, 1))}
      />
      <div className="p-4">
        <p className="text-muted-foreground">Workout page content coming soon...</p>
      </div>
    </div>
  );
}
