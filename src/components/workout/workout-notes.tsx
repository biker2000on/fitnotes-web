'use client';

import { useState, useEffect } from 'react';
import { MessageSquarePlus, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CommentDialog } from './comment-dialog';
import { getWorkoutComment, upsertWorkoutComment, deleteComment } from '@/actions/comments';

interface WorkoutNotesProps {
  date: string;
}

export function WorkoutNotes({ date }: WorkoutNotesProps) {
  const [comment, setComment] = useState('');
  const [commentId, setCommentId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadComment = async () => {
      setIsLoading(true);
      const workoutComment = await getWorkoutComment(date);
      if (workoutComment) {
        setComment(workoutComment.comment);
        setCommentId(workoutComment.id);
      } else {
        setComment('');
        setCommentId(null);
      }
      setIsLoading(false);
    };
    loadComment();
  }, [date]);

  const handleSaveComment = async (commentText: string) => {
    const savedComment = await upsertWorkoutComment(date, commentText);
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

  if (isLoading) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Workout Notes</CardTitle>
          <CommentDialog
            initialComment={comment}
            onSave={handleSaveComment}
            onDelete={comment ? handleDeleteComment : undefined}
            title="Workout Notes"
            trigger={
              comment ? (
                <MessageSquare className="h-5 w-5 fill-current text-muted-foreground hover:text-foreground cursor-pointer" />
              ) : (
                <MessageSquarePlus className="h-5 w-5 text-muted-foreground hover:text-foreground cursor-pointer" />
              )
            }
          />
        </div>
      </CardHeader>
      {comment && (
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{comment}</p>
        </CardContent>
      )}
    </Card>
  );
}
