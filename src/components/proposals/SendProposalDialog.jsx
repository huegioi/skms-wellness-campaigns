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

    const items = [];
    let subtotal = 0;

    if (sel.workshops?.length > 0) {
      sel.workshops.forEach(k => {
        const price = getPrice('workshops', k);
        subtotal += price;
        items.push({ category: 'Workshops', name: productCatalog.workshops[k]?.name, price });
      });
    }
    if (sel.challengePrograms?.length > 0) {
      sel.challengePrograms.forEach(k => {
        const price = getPrice('challenges', k);
        subtotal += price;
        items.push({ category: '14-Day Challenges', name: productCatalog.challenges[k]?.name, price });
      });
    }
    if (sel.leadership?.length > 0) {
      sel.leadership.forEach(k => {
        const price = getPrice('leadership', k);
        subtotal += price;
        items.push({ category: 'Leadership Programs', name: productCatalog.leadership[k]?.name, price });
      });
    }
    if (sel.movementClasses?.length > 0) {
      sel.movementClasses.forEach(k => {
        const price = getPrice('movementClasses', k);
        subtotal += price;
        items.push({ category: 'Classes', name: productCatalog.movementClasses[k]?.name, price });
      });
    }
    // Add wellness boxes - check both wellnessBoxes and sampleBoxQuantities
    const boxData = sel.wellnessBoxes || sel.sampleBoxQuantities || {};
    const boxPrices = sel.wellnessBoxPrices || { reduceStress: 65, relaxationSleep: 65, largeEmotional: 125, largeStressReduction: 125 };
    const boxNames = {
      reduceStress: 'Reduce Stress Box',
      relaxationSleep: 'Relaxation & Sleep Box',
      largeEmotional: 'Large Emotional Wellness Box',
      largeStressReduction: 'Large Stress Reduction Box'
    };
    Object.entries(boxData).forEach(([key, qty]) => {
      if (qty > 0) {
        const boxPrice = boxPrices[key] || 0;
        const totalBoxPrice = boxPrice * qty;
        subtotal += totalBoxPrice;
        items.push({ 
          category: 'Wellness Boxes', 
          name: `${boxNames[key] || key} (x${qty})`, 
          price: totalBoxPrice 
        });
      }
    });

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #013f7c; text-align: center; margin-bottom: 5px;">Mental Fitness Campaign Proposal</h2>
        <p style="text-align: center; color: #666; margin-top: 0;"><strong>Prepared for:</strong> ${proposal.client_name}${proposal.company ? ` | ${proposal.company}` : ''}</p>
        
        ${proposal.narrative_summary ? `
          <div style="background: #f8f8f8; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #013f7c; margin: 0 0 10px; text-align: center;">Program Overview</h3>
            <p style="color: #333; line-height: 1.7; margin: 0; white-space: pre-line;">${proposal.narrative_summary}</p>
          </div>
        ` : ''}
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #264d44; color: white;">
              <th style="padding: 12px; text-align: left;">Service</th>
              <th style="padding: 12px; text-align: right; width: 100px;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item, i) => `
              <tr style="background: ${i % 2 === 0 ? '#f9f9f9' : '#ffffff'};">
                <td style="padding: 10px 12px; border-bottom: 1px solid #eee;">
                  <span style="color: #666; font-size: 12px;">${item.category}</span><br>
                  <span style="color: #333;">${item.name}</span>
                </td>
                <td style="padding: 10px 12px; text-align: right; border-bottom: 1px solid #eee; color: #333;">$${item.price.toLocaleString()}</td>
              </tr>
            `).join('')}
            <tr style="background: #f0f0f0; font-weight: bold;">
              <td style="padding: 12px; text-align: right; color: #333;">Subtotal:</td>
              <td style="padding: 12px; text-align: right; color: #333;">$${subtotal.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        
        <div style="background: #770142; color: white; padding: 20px; border-radius: 8px; text-align: center; margin-top: 20px;">
          <p style="margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Total Investment</p>
          <p style="margin: 10px 0 0; font-size: 32px; font-weight: bold;">$${proposal.total_amount?.toLocaleString()}</p>
        </div>
      </div>
    `;
  };

  const handleSend = async () => {
    if (!email) return;
    setSending(true);
    
    // Build the public URL for the proposal viewer
    let baseUrl = window.location.origin;
    // Remove any preview or edit prefixes for production URLs
    baseUrl = baseUrl.replace('/preview', '').replace('edit.', '');
    const portalLink = `${baseUrl}/ViewProposal?id=${proposal.id}`;
    console.log('Portal link:', portalLink);
    const proposalHTML = generateProposalHTML();
    const emailBody = `${message.replace(/\n/g, '<br>')}<br><br>
      <div style="text-align: center; margin: 20px 0;">
        <a href="${portalLink}" style="background: #770142; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; display: inline-block;">View Your Proposal Online</a>
      </div>
      <hr><br>${proposalHTML}`;
    
    try {
      await base44.functions.invoke('sendGmailEmail', {
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
      alert(`Failed to send email: ${error.message || 'Unknown error'}`);
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