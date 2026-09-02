import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getOrgDomain } from '@/lib/emailDomain';
import { clientOrgName } from '@/lib/clientContacts';

export default function DuplicateChecker({ clients, email, company, currentClientId, onSelectDuplicate }) {
  const duplicates = [];
  
  // Check for email matches
  if (email) {
    const emailLower = email.toLowerCase().trim();
    clients.forEach(client => {
      if (client.id !== currentClientId && client.email?.toLowerCase().trim() === emailLower) {
        duplicates.push({ client, matchType: 'email' });
      }
      // Also check related contacts
      (client.related_contacts || []).forEach(contact => {
        if (contact.email?.toLowerCase().trim() === emailLower) {
          duplicates.push({ client, matchType: 'related contact email' });
        }
      });
    });
  }
  
  // Check for email DOMAIN matches.
  // The exact-address check above misses the most common duplicate of all: a
  // second person at an organization we already have. Matching
  // agnes.morawski@partnerre.com against amanda.pacheco@partnerre.com is what
  // would have prevented the duplicate Partner Reinsurance record. Free-mail
  // domains identify a person rather than an org, so getOrgDomain drops them.
  const inputDomain = getOrgDomain(email);
  if (inputDomain) {
    clients.forEach(client => {
      if (client.id === currentClientId) return;
      const clientDomain = client.email_domain || getOrgDomain(client.email);
      if (clientDomain === inputDomain && !duplicates.find(d => d.client.id === client.id)) {
        duplicates.push({ client, matchType: 'email domain' });
      }
    });
  }

  // Check for company name matches
  if (company) {
    const companyLower = company.toLowerCase().trim();
    clients.forEach(client => {
      if (client.id !== currentClientId && client.company?.toLowerCase().trim() === companyLower) {
        // Avoid adding duplicate entries
        if (!duplicates.find(d => d.client.id === client.id)) {
          duplicates.push({ client, matchType: 'company' });
        }
      }
    });
  }
  
  if (duplicates.length === 0) return null;
  
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-2">
        <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-amber-800">Potential Duplicates Found</p>
          <p className="text-sm text-amber-700 mb-3">The following existing clients match your input:</p>
          <div className="space-y-2">
            {duplicates.map(({ client, matchType }, index) => (
              <div key={index} className="bg-white rounded border border-amber-200 p-3 flex justify-between items-center">
                <div>
                  {/* The organization is the client's identity; the contact is
                      the subtitle. */}
                  <p className="font-medium text-gray-800">{clientOrgName(client)}</p>
                  <p className="text-sm text-gray-600">
                    {client.name && client.name !== clientOrgName(client) && <span>{client.name} • </span>}
                    {client.email}
                  </p>
                  <p className="text-xs text-amber-600">Matched by: {matchType}</p>
                </div>
                {onSelectDuplicate && (
                  <Button size="sm" variant="outline" onClick={() => onSelectDuplicate(client)}>
                    View Client
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}