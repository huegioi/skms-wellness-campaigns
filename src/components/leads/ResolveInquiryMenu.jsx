import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Check, MoreVertical, Mail, Ban, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ResolveInquiryMenu({ lead }) {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState(null);
  const [notes, setNotes] = useState('');

  const resolveMutation = useMutation({
    mutationFn: async ({ action, notes: note }) => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const update = {
        status: action === 'contacted' ? 'contacted' : 'not_interested',
        last_contacted_date: today,
      };
      if (note?.trim()) {
        update.notes = `${(lead.notes || '').trim()}\n[Resolution — ${format(new Date(), 'MMM d, yyyy')}] ${note.trim()}`.trim();
      }
      return base44.entities.Lead.update(lead.id, update);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['leads', 'company_inquiry'] });
      queryClient.invalidateQueries({ queryKey: ['referrals', 'for-inquiries'] });
      toast.success('Inquiry resolved');
      setConfirmAction(null);
      setNotes('');
    },
    onError: (e) => {
      toast.error('Failed to resolve: ' + (e.response?.data?.error || e.message));
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-700 h-8 w-8 p-0">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Resolve inquiry</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setConfirmAction({ type: 'contacted', label: 'Mark as Contacted' })}
            className="cursor-pointer"
          >
            <Mail className="w-4 h-4 mr-2 text-green-600" />
            Mark as Contacted
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setConfirmAction({ type: 'not_interested', label: 'Not Interested' })}
            className="cursor-pointer"
          >
            <Ban className="w-4 h-4 mr-2 text-red-500" />
            Not Interested
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!confirmAction} onOpenChange={(v) => { if (!v) { setConfirmAction(null); setNotes(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{confirmAction?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-gray-50 rounded-lg p-3 text-sm">
              <p className="font-medium text-gray-700">{lead.company || lead.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {lead.name}{lead.email ? ` · ${lead.email}` : ''}
              </p>
            </div>
            <div>
              <Label htmlFor="resolve-notes" className="mb-1.5 block">Notes (optional)</Label>
              <Textarea
                id="resolve-notes"
                rows={3}
                placeholder="Add context about this resolution…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmAction(null); setNotes(''); }}>Cancel</Button>
            <Button
              onClick={() => resolveMutation.mutate({ action: confirmAction.type, notes })}
              disabled={resolveMutation.isPending}
            >
              {resolveMutation.isPending
                ? <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                : <Check className="w-4 h-4 mr-1" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}