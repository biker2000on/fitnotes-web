'use client';

import { useState, useEffect } from 'react';
import { Check, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { PRBadge } from './pr-badge';
import { CommentDialog } from './comment-dialog';
import { getSetComment, upsertSetComment, deleteComment } from '@/actions/comments';

interface SetRowProps {
  set: {
    id: number;
    metricWeight: number;
    reps: number;
    isComplete: boolean;
    isPersonalRecord: boolean;
  };
  setNumber: number;
  isMetric: boolean;
  workoutDate: string;
  onUpdate: (id: number, data: { metricWeight?: number; reps?: number; isComplete?: boolean }) => void;
  onDelete: (id: number) => void;
}

export function SetRow({ set, setNumber, isMetric, workoutDate, onUpdate, onDelete }: SetRowProps) {
  const displayWeight = isMetric ? set.metricWeight / 1000 : set.metricWeight / 453.592;
  const [weight, setWeight] = useState(displayWeight.toFixed(1));
  const [reps, setReps] = useState(set.reps.toString());
  const [comment, setComment] = useState('');
  const [commentId, setCommentId] = useState<number | null>(null);

  // Load comment for this set
  useEffect(() => {
    const loadComment = async () => {
      const existingComment = await getSetComment(set.id);
      if (existingComment) {
        setComment(existingComment.comment);
        setCommentId(existingComment.id);
      }
    };
    loadComment();
  }, [set.id]);

  const handleWeightBlur = () => {
    const parsed = parseFloat(weight);
    if (!isNaN(parsed)) {
      const grams = isMetric ? parsed * 1000 : Math.round(parsed * 453.592);
      onUpdate(set.id, { metricWeight: grams });
    }
  };

  const handleRepsBlur = () => {
    const parsed = parseInt(reps);
    if (!isNaN(parsed)) {
      onUpdate(set.id, { reps: parsed });
    }
  };

  const handleSaveComment = async (commentText: string) => {
    const savedComment = await upsertSetComment(set.id, workoutDate, commentText);
    if (savedComment) {
      setComment(savedComment.comment);
      setCommentId(savedComment.id);
    }
  };

  const handleDeleteComment = async () => {
    if (commentId) {
      await deleteComment(commentId);
      setComment('');
      setCommentId(null);
    }
  };

  return (
    <div className={cn(
      'flex items-center gap-2 p-2 rounded-lg',
      set.isComplete && 'bg-green-500/10'
    )}>
      <span className="w-8 text-center text-sm text-muted-foreground">{setNumber}</span>

      {set.isPersonalRecord && <PRBadge />}

      <div className="flex items-center gap-1 flex-1">
        <Input
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onBlur={handleWeightBlur}
          className="w-20 text-center"
        />
        <span className="text-sm text-muted-foreground">{isMetric ? 'kg' : 'lb'}</span>
      </div>

      <span className="text-muted-foreground">×</span>

      <Input
        type="number"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={handleRepsBlur}
        className="w-16 text-center"
      />

      <Button
        variant={set.isComplete ? 'default' : 'outline'}
        size="icon"
        className="h-8 w-8"
        onClick={() => onUpdate(set.id, { isComplete: !set.isComplete })}
      >
        <Check className="h-4 w-4" />
      </Button>

      <CommentDialog
        initialComment={comment}
        onSave={handleSaveComment}
        onDelete={comment ? handleDeleteComment : undefined}
        title={`Set ${setNumber} Comment`}
      />

      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(set.id)}>
        <Trash className="h-4 w-4" />
      </Button>
    </div>
  );
}
