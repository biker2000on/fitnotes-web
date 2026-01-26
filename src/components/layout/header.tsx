'use client';

import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  title?: string;
  showDateNav?: boolean;
  date?: Date;
  onPrevDate?: () => void;
  onNextDate?: () => void;
}

export function Header({ title, showDateNav, date, onPrevDate, onNextDate }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="flex h-14 items-center justify-between px-4">
        {showDateNav && date ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onPrevDate}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <span className="font-medium">{format(date, 'EEE, MMM d')}</span>
            <Button variant="ghost" size="icon" onClick={onNextDate}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        ) : (
          <h1 className="text-lg font-semibold">{title}</h1>
        )}
        <Button variant="ghost" size="icon">
          <User className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
