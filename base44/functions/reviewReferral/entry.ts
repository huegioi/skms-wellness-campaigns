import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { referral_id, action, review_notes } = await req.json();
  // action: 'approve' | 'reject'

  if (!referral_id || !action) {
    return Response.json({ error: 'referral_id and action are required' }, { status: 400 });
  }

  const referrals = await base44.asServiceRole.entities.Referral.filter({ id: referral_id });
  if (!referrals || referrals.length === 0) {
    return Response.json({ error: 'Referral not found' }, { status: 404 });
  }
  const referral = referrals[0];

  if (referral.status !== 'pending_review') {
    return Response.json({ error: 'Referral is not pending review' }, { status: 400 });
  }

  if (action === 'reject') {
    await base44.asServiceRole.entities.Referral.update(referral_id, {
      status: 'not_eligible',
      review_notes: review_notes || '',
      reviewed_date: new Date().toISOString()
    });
    return Response.json({ success: true, status: 'not_eligible' });
  }

  if (action === 'approve') {
    // Approve: move to submitted status
    await base44.asServiceRole.entities.Referral.update(referral_id, {
      status: 'submitted',
      review_notes: review_notes || '',
      reviewed_date: new Date().toISOString()
    });
    return Response.json({ success: true, status: 'submitted' });
  }

  return Response.json({ error: 'Invalid action. Use approve or reject.' }, { status: 400 });
});