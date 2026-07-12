import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * Accept / Can't make it bar for presenter portal sessions.
 * Shows when the session hasn't been accepted yet.
 * Decline opens a dialog with an optional reason, then clears the presenter assignment.
 */
export default function PresenterAcceptBar({ event, portalId, onUpdated }) {
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [reason, setReason] = useState('');

  if (event.presenter_accepted) return null;

  const handleAccept = async () => {
    setAccepting(true);
    await base44.functions.invoke('updatePresenterSession', {
      portal_id: portalId, event_id: event.id, accepted: true
    });
    setAccepting(false);
    onUpdated();
  };

  const handleDecline = async () => {
    setDeclining(true);
    await base44.functions.invoke('updatePresenterSession', {
      portal_id: portalId,
      event_id: event.id,
      accepted: false,
      decline_reason: reason || undefined
    });
    setDeclining(false);
    setShowDeclineDialog(false);
    onUpdated();
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          onClick={(e) => { e.stopPropagation(); handleAccept(); }}
          disabled={accepting || declining}
          size="sm"
          className="bg-[#264d44] hover:bg-[#1a3830] text-white"
        >
          {accepting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
          Accept
        </Button>
        <Button
          onClick={(e) => { e.stopPropagation(); setShowDeclineDialog(true); }}
          disabled={accepting || declining}
          variant="outline"
          size="sm"
          className="text-red-600 border-red-300 hover:bg-red-50"
        >
          <XCircle className="w-3.5 h-3.5 mr-1" />
          Can't make it
        </Button>
      </div>

      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Decline this session?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              The team will be notified that you can't make it. This session will be removed from your portal and reassigned.
            </p>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason (optional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. scheduling conflict, prior commitment..."
                rows={3}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDeclineDialog(false)} className="text-sm">
              Cancel
            </Button>
            <Button
              onClick={handleDecline}
              disabled={declining}
              className="bg-red-600 hover:bg-red-700 text-white text-sm"
            >
              {declining ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
              Confirm decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}