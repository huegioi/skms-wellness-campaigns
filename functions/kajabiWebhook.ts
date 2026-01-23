import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Parse webhook payload
    const payload = await req.json();
    
    // Kajabi webhook structure: { event_type, data: { ... } }
    const eventType = payload.event_type || payload.type;
    const eventData = payload.data || payload;
    
    // Extract common fields
    const contactEmail = eventData.email || eventData.member?.email || eventData.contact?.email;
    const contactName = eventData.name || eventData.member?.name || eventData.contact?.name;
    
    // Build event record
    const eventRecord = {
      event_type: eventType,
      contact_email: contactEmail,
      contact_name: contactName,
      event_data: eventData,
      event_date: new Date().toISOString()
    };
    
    // Add specific fields based on event type
    if (eventType === 'form_submitted' || eventType === 'form.submitted') {
      eventRecord.form_name = eventData.form_name || eventData.form?.name;
    }
    
    if (eventType === 'member_tag_added' || eventType === 'member_tag_removed' || 
        eventType === 'tag.added' || eventType === 'tag.removed') {
      eventRecord.tag_name = eventData.tag_name || eventData.tag?.name;
    }
    
    if (eventType === 'offer_purchased' || eventType === 'subscription_created' ||
        eventType === 'offer.purchased' || eventType === 'subscription.created') {
      eventRecord.product_name = eventData.product_name || eventData.offer?.name || eventData.product?.name;
    }
    
    // Store event
    await base44.asServiceRole.entities.KajabiEvent.create(eventRecord);
    
    // If it's a new contact event, also sync the contact data
    if (eventType === 'member_created' || eventType === 'member.created') {
      const existingContact = await base44.asServiceRole.entities.KajabiContact.filter({
        email: contactEmail
      });
      
      if (existingContact.length === 0 && contactEmail) {
        await base44.asServiceRole.entities.KajabiContact.create({
          kajabi_id: eventData.id || eventData.member_id,
          name: contactName || '',
          email: contactEmail,
          subscribed: eventData.subscribed !== false,
          phone_number: eventData.phone_number || '',
          tags: eventData.tags || [],
          kajabi_created_at: eventData.created_at || new Date().toISOString(),
          last_synced: new Date().toISOString()
        });
      }
    }
    
    return Response.json({ success: true, event_type: eventType });
    
  } catch (error) {
    console.error('Kajabi webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});