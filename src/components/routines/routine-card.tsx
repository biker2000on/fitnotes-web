'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit, Trash2, Copy } from 'lucide-react';
import type { Routine } from '@/types/routine';
import Link from 'next/link';

type RoutineCardProps = {
  routine: Routine;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onDuplicate: (id: number) => void;
};

export function RoutineCard({ routine, onEdit, onDelete, onDuplicate }: RoutineCardProps) {
  const sectionCount = routine.sections.length;
  const exerciseCount = routine.sections.reduce((acc, section) => acc + section.exercises.length, 0);

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer">
      <Link href={`/routines/${routine.id}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <CardTitle className="text-lg">{routine.name}</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    onEdit(routine.id);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    onDuplicate(routine.id);
                  }}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete(routine.id);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {routine.notes && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {routine.notes}
            </p>
          )}
          <div className="flex gap-4 text-sm text-muted-foreground">
            <div>
              <span className="font-semibold text-foreground">{sectionCount}</span> section{sectionCount !== 1 ? 's' : ''}
            </div>
            <div>
              <span className="font-semibold text-foreground">{exerciseCount}</span> exercise{exerciseCount !== 1 ? 's' : ''}
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
