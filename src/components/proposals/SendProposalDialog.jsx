import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { productCatalog } from '@/components/curriculum/catalogData';

export default function SendProposalDialog({ proposal, open, onOpenChange, onSent }) {
  const [email, setEmail] = useState(proposal?.client_email || '');
  const [subject, setSubject] = useState(`Mental Fitness Campaign Proposal for ${proposal?.company || proposal?.client_name}`);
  const [message, setMessage] = useState(`Dear ${proposal?.client_name},

Thank you for your interest in SkillfulMeans' mental fitness programs. Please find attached your customized proposal.

Total Investment: $${proposal?.total_amount?.toLocaleString()}

We look forward to partnering with you to support your team's well-being.

Best regards,
SkillfulMeans Team`);
  const [sending, setSending] = useState(false);

  const generateProposalHTML = () => {
    const sel = proposal.selections || {};
    const getPrice = (category, key) => {
      const overrideKey = `${category}_${key}`;
      if (sel.priceOverrides?.[overrideKey] !== undefined) return sel.priceOverrides[overrideKey];
      if (category === 'workshops') return productCatalog.workshops[key]?.price || 0;
      if (category === 'challenges') return 1500;
      if (category === 'leadership') return productCatalog.leadership[key]?.price || 0;
      if (category === 'movementClasses') return productCatalog.movementClasses[key]?.price || 0;
      return 0;
    };

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #013f7c;">Mental Fitness Campaign Proposal</h2>
        <p><strong>Prepared for:</strong> ${proposal.client_name}</p>
        ${proposal.company ? `<p><strong>Company:</strong> ${proposal.company}</p>` : ''}
        
        ${proposal.narrative_summary ? `
          <div style="background: linear-gradient(135deg, rgba(119, 1, 66, 0.08), rgba(1, 63, 124, 0.08)); border-left: 4px solid #770142; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #770142; margin: 0 0 10px;">Program Overview</h3>
            <p style="color: #333; line-height: 1.7; margin: 0; white-space: pre-line;">${proposal.narrative_summary}</p>
          </div>
        ` : ''}
        
        ${sel.workshops?.length > 0 ? `
          <h3 style="color: #264d44; border-bottom: 2px solid #cae5e3;">Workshops</h3>
          <ul>${sel.workshops.map(k => `<li>${productCatalog.workshops[k]?.name} - $${getPrice('workshops', k).toLocaleString()}</li>`).join('')}</ul>
        ` : ''}
        
        ${sel.challengePrograms?.length > 0 ? `
          <h3 style="color: #264d44; border-bottom: 2px solid #cae5e3;">14-Day Challenges</h3>
          <ul>${sel.challengePrograms.map(k => `<li>${productCatalog.challenges[k]?.name} - $${getPrice('challenges', k).toLocaleString()}</li>`).join('')}</ul>
        ` : ''}
        
        ${sel.leadership?.length > 0 ? `
          <h3 style="color: #264d44; border-bottom: 2px solid #cae5e3;">Leadership Programs</h3>
          <ul>${sel.leadership.map(k => `<li>${productCatalog.leadership[k]?.name} - $${getPrice('leadership', k).toLocaleString()}</li>`).join('')}</ul>
        ` : ''}
        
        ${sel.movementClasses?.length > 0 ? `
          <h3 style="color: #264d44; border-bottom: 2px solid #cae5e3;">Classes</h3>
          <ul>${sel.movementClasses.map(k => `<li>${productCatalog.movementClasses[k]?.name} - $${getPrice('movementClasses', k).toLocaleString()}</li>`).join('')}</ul>
        ` : ''}
        
        <div style="background: linear-gradient(135deg, #770142, #441d37); color: white; padding: 20px; border-radius: 8px; text-align: center; margin-top: 20px;">
          <p style="margin: 0; font-size: 16px;">Total Investment</p>
          <p style="margin: 10px 0 0; font-size: 28px; font-weight: bold;">$${proposal.total_amount?.toLocaleString()}</p>
        </div>
      </div>
    `;
  };

  const handleSend = async () => {
    if (!email) return;
    setSending(true);
    
    const portalLink = `${window.location.origin}/ViewProposal?id=${proposal.id}`;
    const emailBody = `${message.replace(/\n/g, '<br>')}<br><br>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${portalLink}" style="background: #770142; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">View Your Proposal Online</a>
      </div>
      <hr><br>${generateProposalHTML()}`;
    
    try {
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: subject,
        body: emailBody
      });

      await base44.entities.Proposal.update(proposal.id, {
        status: 'sent',
        client_email: email,
        sent_date: new Date().toISOString()
      });

      onSent?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to send email:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Proposal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
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
          <Button onClick={handleSend} disabled={!email || sending} className="w-full bg-[#770142] hover:bg-[#5a0132]">
            {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            {sending ? 'Sending...' : 'Send Proposal'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}