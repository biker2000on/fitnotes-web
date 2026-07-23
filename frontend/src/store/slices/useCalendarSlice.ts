// Calendar slice: month navigation and the day-preview modal.
// Code moved verbatim from FitNotesStore.tsx.
import { useState, useEffect } from 'react';
import { db } from '../../storage/db';
import type { TrainingLog, WorkoutComment } from '../../types';

export interface CalendarSliceDeps {
  selectedDate: string;
  allLogs: TrainingLog[];
}

export function useCalendarSlice(deps: CalendarSliceDeps) {
  const { selectedDate, allLogs } = deps;

  // Calendar day preview modal states
  const [showCalendarPreviewModal, setShowCalendarPreviewModal] = useState(false);
  const [previewDate, setPreviewDate] = useState('');
  const [previewLogs, setPreviewLogs] = useState<TrainingLog[]>([]);
  const [previewComment, setPreviewComment] = useState<string>('');

  // Calendar Navigation State
  const [calendarYear, setCalendarYear] = useState<number>(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState<number>(new Date().getMonth()); // 0-11

  // Auto-sync calendar view with selected date changes
  useEffect(() => {
    if (selectedDate) {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        if (!isNaN(year) && !isNaN(month)) {
          if (year !== calendarYear || month !== calendarMonth) {
            setCalendarYear(year);
            setCalendarMonth(month);
          }
        }
      }
    }
  }, [selectedDate]);

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(prev => prev - 1);
    } else {
      setCalendarMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(prev => prev + 1);
    } else {
      setCalendarMonth(prev => prev + 1);
    }
  };

  const handleCalendarDayClick = async (dateStr: string) => {
    setPreviewDate(dateStr);
    const logsForDate = allLogs.filter(l => l.date === dateStr && !l.is_deleted);
    setPreviewLogs(logsForDate);

    // Fetch comment for this date!
    const comments = await db.query<WorkoutComment>('SELECT * FROM workout_comments WHERE date = ?', [dateStr]);
    if (comments.length > 0) {
      setPreviewComment(comments[0].comment);
    } else {
      setPreviewComment('');
    }

    setShowCalendarPreviewModal(true);
  };

  return {
    showCalendarPreviewModal, setShowCalendarPreviewModal,
    previewDate, setPreviewDate, previewLogs, setPreviewLogs, previewComment, setPreviewComment,
    calendarYear, setCalendarYear, calendarMonth, setCalendarMonth,
    handlePrevMonth, handleNextMonth, handleCalendarDayClick,
  };
}
