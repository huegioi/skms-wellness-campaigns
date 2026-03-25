import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const CORPORATE_LEADS_TAG = 'corporate leads';

// Validate contact data
function validateContactData(data) {
  if (!data.email || typeof data.email !== 'string') {
    throw new Error('Invalid contact: email is required');
  }
  if (!data.kajabi_id || typeof data.kajabi_id !== 'string') {
    throw new Error('Invalid contact: kajabi_id is required');
  }
  if (data.subscribed !== undefined && typeof data.subscribed !== 'boolean') {
    throw new Error('Invalid contact: subscribed must be boolean');
  }
  if (data.tags && !Array.isArray(data.tags)) {
    throw new Error('Invalid contact: tags must be array');
  }
  return true;
}

// Check if contact has corporate leads tag
function hasCorporateLeadsTag(tags) {
  if (!Array.isArray(tags)) return false;
  return tags.some(tag => 
    tag.toLowerCase().trim() === CORPORATE_LEADS_TAG.toLowerCase()
  );
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const payload = await req.json();
    
    const eventType = payload.event_type || payload.type;
    const eventData = payload.data || payload;
    
    const contactEmail = eventData.email || eventData.member?.email || eventData.contact?.email;
    const contactName = eventData.name || eventData.member?.name || eventData.contact?.name;
    const contactId = eventData.id || eventData.member_id || eventData.contact_id;
    const tags = eventData.tags || [];
    
    // Build event record
    const eventRecord = {
      event_type: eventType,
      contact_email: contactEmail,
      contact_name: contactName,
      event_data: eventData,
      event_date: new Date().toISOString()
    };
    
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
    
    // Always store event
    await base44.asServiceRole.entities.KajabiEvent.create(eventRecord);
    
    // Handle contact updates (create, update, tag changes)
    if (contactEmail && contactId) {
      const existingContacts = await base44.asServiceRole.entities.KajabiContact.filter({
        kajabi_id: contactId
      });
      
      const contactData = {
        kajabi_id: contactId,
        name: contactName || '',
        email: contactEmail,
        subscribed: eventData.subscribed !== false,
        phone_number: eventData.phone_number || '',
        tags: tags,
        kajabi_created_at: eventData.created_at || new Date().toISOString(),
        last_synced: new Date().toISOString()
      };
      
      try {
        validateContactData(contactData);
        
        // Tag-based filtering logic
        const hasCorporateTag = hasCorporateLeadsTag(tags);
        
        if (eventType === 'member_created' || eventType === 'member.created') {
          // Only create if has corporate leads tag
          if (hasCorporateTag && existingContacts.length === 0) {
            await base44.asServiceRole.entities.KajabiContact.create(contactData);
            console.log(`Created new corporate lead: ${contactEmail}`);
          }
        } else if (eventType === 'member_updated' || eventType === 'member.updated') {
          // Update existing contact if it exists
          if (existingContacts.length > 0) {
            // Idempotency: only update if data changed
            const existing = existingContacts[0];
            const hasChanges = 
              existing.name !== contactData.name ||
              existing.email !== contactData.email ||
              existing.subscribed !== contactData.subscribed ||
              existing.phone_number !== contactData.phone_number ||
              JSON.stringify(existing.tags || []) !== JSON.stringify(contactData.tags);
            
            if (hasChanges) {
              await base44.asServiceRole.entities.KajabiContact.update(existing.id, contactData);
              console.log(`Updated corporate lead: ${contactEmail}`);
            }
          }
        } else if (eventType === 'member_tag_added' || eventType === 'tag.added') {
          const tagName = eventData.tag_name || eventData.tag?.name;
          
          // If corporate leads tag was added
          if (tagName?.toLowerCase().trim() === CORPORATE_LEADS_TAG.toLowerCase()) {
            if (existingContacts.length > 0) {
              // Update existing contact with new tag
              const existing = existingContacts[0];
              const updatedTags = [...new Set([...(existing.tags || []), tagName])];
              await base44.asServiceRole.entities.KajabiContact.update(existing.id, {
                tags: updatedTags,
                last_synced: new Date().toISOString()
              });
              console.log(`Added corporate leads tag to: ${contactEmail}`);
            } else {
              // Create new contact since they now have the tag
              await base44.asServiceRole.entities.KajabiContact.create(contactData);
              console.log(`Created new corporate lead from tag event: ${contactEmail}`);
            }
          } else if (existingContacts.length > 0) {
            // Update tags for existing contact
            const existing = existingContacts[0];
            const updatedTags = [...new Set([...(existing.tags || []), tagName])];
            await base44.asServiceRole.entities.KajabiContact.update(existing.id, {
              tags: updatedTags,
              last_synced: new Date().toISOString()
            });
          }
        } else if (eventType === 'member_tag_removed' || eventType === 'tag.removed') {
          const tagName = eventData.tag_name || eventData.tag?.name;
          
          if (existingContacts.length > 0) {
            const existing = existingContacts[0];
            const updatedTags = (existing.tags || []).filter(t => t !== tagName);
            
            // If corporate leads tag was removed, delete the contact
            if (tagName?.toLowerCase().trim() === CORPORATE_LEADS_TAG.toLowerCase()) {
              await base44.asServiceRole.entities.KajabiContact.delete(existing.id);
              console.log(`Removed contact (corporate leads tag removed): ${contactEmail}`);
            } else {
              // Just update tags
              await base44.asServiceRole.entities.KajabiContact.update(existing.id, {
                tags: updatedTags,
                last_synced: new Date().toISOString()
              });
            }
          }
        }
      } catch (validationError) {
        console.warn(`Validation failed for contact ${contactId}: ${validationError.message}`);
      }
    }
    
    return Response.json({ success: true, event_type: eventType, processed: true });
    
  } catch (error) {
    console.error('Kajabi webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});