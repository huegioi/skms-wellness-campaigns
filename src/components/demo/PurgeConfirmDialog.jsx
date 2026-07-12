import React from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';

export default function PurgeConfirmDialog({ open, onOpenChange, onConfirm, isPurging }) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Purge all demo data?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes every record flagged as demo data across all entities
            — clients, partners, referrals, proposals, events, feedback, assessments, tasks,
            and activities. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPurging}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => { e.preventDefault(); onConfirm(); }}
            disabled={isPurging}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {isPurging
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Purging...</>
              : 'Purge demo data'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}