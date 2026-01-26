
'use client';

import { Star, MoreVertical, Pencil, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CategoryBadge } from './category-badge';
import { cn } from '@/lib/utils';

interface ExerciseItemProps {
  exercise: {
    id: number;
    name: string;
    isFavorite: boolean;
    category: { name: string; color: string } | null;
  };
  onSelect?: (id: number) => void;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  onToggleFavorite?: (id: number) => void;
}

export function ExerciseItem({ exercise, onSelect, onEdit, onDelete, onToggleFavorite }: ExerciseItemProps) {
  return (
    <div
      className="flex items-center justify-between p-3 hover:bg-accent rounded-lg cursor-pointer"
      onClick={() => onSelect?.(exercise.id)}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(exercise.id); }}
          className="text-muted-foreground hover:text-yellow-500"
        >
          <Star className={cn('h-4 w-4', exercise.isFavorite && 'fill-yellow-500 text-yellow-500')} />
        </button>
        <div>
          <p className="font-medium">{exercise.name}</p>
          {exercise.category && (
            <CategoryBadge name={exercise.category.name} color={exercise.category.color} />
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit?.(exercise.id)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={() => onDelete?.(exercise.id)}>
            <Trash className="mr-2 h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
