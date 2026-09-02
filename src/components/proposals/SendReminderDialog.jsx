import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Bell, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { proposalContactName } from '@/components/proposals/SendProposalDialog';

export default function SendReminderDialog({ proposal, open, onOpenChange, onSent }) {
  // `client_name` is stamped from `Client.name`, which often holds the
  // organization — greet the human only when we actually have one.
  const contactName = proposalContactName(proposal);
  const [email, setEmail] = useState(proposal?.client_email || '');
  const [subject, setSubject] = useState(`Reminder: Your Mental Fitness Campaign Proposal`);
  const [message, setMessage] = useState(`${contactName ? `Dear ${contactName},` : 'Hello,'}

I wanted to follow up on the mental fitness campaign proposal we sent on ${proposal?.sent_date ? new Date(proposal.sent_date).toLocaleDateString() : 'recently'}.

We're excited about the opportunity to support your team's well-being and would love to discuss any questions you might have.

Proposal Summary:
- Total Investment: $${proposal?.total_amount?.toLocaleString()}

Please let us know if you'd like to schedule a call to discuss further.

Best regards,
SkillfulMeans Team`);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!email) return;
    setSending(true);
    
    await base44.integrations.Core.SendEmail({
      to: email,
      subject: subject,
      body: message.replace(/\n/g, '<br>')
    });

    await base44.entities.Proposal.update(proposal.id, {
      last_reminder_date: new Date().toISOString(),
      reminder_count: (proposal.reminder_count || 0) + 1
    });

    // Update client's last contacted date
    if (proposal.client_id) {
      await base44.entities.Client.update(proposal.client_id, {
        last_contacted_date: new Date().toISOString().split('T')[0]
      });
    }

    setSending(false);
    onSent?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[95vw] sm:w-full">
        <DialogHeader>
          <DialogTitle>Send Reminder</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
            <p className="text-amber-800">
              {proposal?.reminder_count > 0 
                ? `${proposal.reminder_count} reminder(s) already sent. Last: ${new Date(proposal.last_reminder_date).toLocaleDateString()}`
                : 'No reminders sent yet for this proposal.'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Recipient Email *</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@company.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Subject</label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Message</label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={8} />
          </div>
          <Button onClick={handleSend} disabled={!email || sending} className="w-full bg-amber-600 hover:bg-amber-700">
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bell className="w-4 h-4 mr-2" />}
            {sending ? 'Sending...' : 'Send Reminder'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}