import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Finds the authenticated caller's Presenter record by email
 * and returns their unique_portal_id. Used to redirect /SpeakerPortal → /PresenterPortal.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const presenters = await base44.asServiceRole.entities.Presenter.filter({ email: user.email });
    if (!presenters || presenters.length === 0) {
      return Response.json({ error: 'Presenter not found' }, { status: 404 });
    }

    return Response.json({ portal_id: presenters[0].unique_portal_id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});