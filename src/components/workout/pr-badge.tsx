import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PRBadgeProps {
  type?: 'weight' | 'volume' | '1rm' | 'any';
  className?: string;
}

/**
 * Badge component to display Personal Record (PR) indicators
 *
 * Shows a trophy icon with "PR" text in a yellow-tinted badge
 * to celebrate when a user achieves a personal record.
 */
export function PRBadge({ type = 'any', className }: PRBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs font-medium text-yellow-600',
        className
      )}
    >
      <Trophy className="h-3 w-3" />
      PR
    </span>
  );
}
