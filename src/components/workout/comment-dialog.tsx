'use client';

import { useState, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface CommentDialogProps {
  initialComment?: string;
  onSave: (comment: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  trigger?: React.ReactNode;
  title?: string;
}

export function CommentDialog({
  initialComment = '',
  onSave,
  onDelete,
  trigger,
  title = 'Add Comment',
}: CommentDialogProps) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState(initialComment);
  const [isSaving, setIsSaving] = useState(false);

  // Update comment when initialComment changes
  useEffect(() => {
    setComment(initialComment);
  }, [initialComment]);

  const handleSave = async () => {
    if (!comment.trim()) return;

    setIsSaving(true);
    try {
      await onSave(comment);
      setOpen(false);
    } catch (error) {
      console.error('Failed to save comment:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;

    setIsSaving(true);
    try {
      await onDelete();
      setComment('');
      setOpen(false);
    } catch (error) {
      console.error('Failed to delete comment:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setOpen(true)}
        >
          <MessageSquare className={initialComment ? 'h-4 w-4 fill-current' : 'h-4 w-4'} />
        </Button>
      )}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Enter your comment..."
          className="min-h-[120px]"
          autoFocus
        />
        <DialogFooter className="gap-2">
          {initialComment && onDelete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSaving}
            >
              Delete
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !comment.trim()}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
