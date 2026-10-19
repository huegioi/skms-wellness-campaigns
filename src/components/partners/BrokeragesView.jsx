import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Building2, Plus, Handshake, ChevronDown, ChevronRight, Search } from 'lucide-react';
import BrokerageDialog from '@/components/partners/BrokerageDialog';
import BrokerageRollup from '@/components/partners/BrokerageRollup';
import { PARTNERSHIP_STATUS, partnershipStatus, hasFirmPartnership, orgTypeLabel, isFirmPartnershipActive } from '@/lib/firmPartnership';

// Firms are split in two:
//   Firm partnerships — a deal with the whole company (prospect / active / inactive)
//   Firm directory    — firms we just group people under; each person's deal is individual
const STATUS_ORDER = { active: 0, prospect: 1, inactive: 2, none: 3 };

export default function BrokeragesView({ partners }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [showDirectory, setShowDirectory] = useState(true);
  const [search, setSearch] = useState('');

  const { data: brokerages = [] } = useQuery({
    queryKey: ['brokerages'],
    queryFn: () => base44.entities.Brokerage.list('-created_date')
  });

  const q = search.trim().toLowerCase();
  const visible = brokerages
    .filter(b => !b.is_demo)
    .filter(b => !q || [b.name, b.company, b.email_domain].some(v => (v || '').toLowerCase().includes(q)));

  const partnerships = visible
    .filter(hasFirmPartnership)
    .sort((a, b) => (STATUS_ORDER[partnershipStatus(a)] - STATUS_ORDER[partnershipStatus(b)]) || (a.name || '').localeCompare(b.name || ''));
  const directory = visible
    .filter(b => !hasFirmPartnership(b))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const peopleAt = (b) => partners.filter(p => p.brokerage_id === b.id && !p.is_demo);

  const renderFirm = (b) => {
    const people = peopleAt(b);
    const status = partnershipStatus(b);
    const deal = hasFirmPartnership(b);
    const contact = b.primary_contact_partner_id ? partners.find(p => p.id === b.primary_contact_partner_id) : null;
    return (
      <Card key={b.id}>
        <CardContent className="pt-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-1">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <button
                  onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                  className="font-semibold text-gray-800 text-lg hover:text-[#013f7c] hover:underline transition-colors text-left"
                >
                  {b.name}
                </button>
                <Badge variant="outline" className="text-gray-600 font-normal">{orgTypeLabel(b)}</Badge>
                {deal && (
                  <Badge className={PARTNERSHIP_STATUS[status].className}>
                    <Handshake className="w-3 h-3 mr-1" /> Firm partnership · {PARTNERSHIP_STATUS[status].short}
                  </Badge>
                )}
                {isFirmPartnershipActive(b) && (
                  <>
                    <Badge className={b.brokerage_commission_enabled !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                      House: {b.brokerage_commission_enabled !== false ? 'On' : 'Off'}
                    </Badge>
                    <Badge className={b.broker_commission_enabled !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                      Broker: {b.broker_commission_enabled !== false ? 'On' : 'Off'}
                    </Badge>
                  </>
                )}
              </div>
              <p className="text-gray-400 text-sm">
                {[b.email_domain, `${people.length} ${people.length === 1 ? 'person' : 'people'} linked`,
                  deal && contact ? `Main contact: ${contact.name}` : null,
                  deal && b.agreement_signed_date ? `Signed ${b.agreement_signed_date}` : null,
                ].filter(Boolean).join(' · ')}
              </p>
              {!deal && people.length > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">No firm deal — each person here is an individual partner.</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setExpanded(expanded === b.id ? null : b.id)}>
                {expanded === b.id ? 'Hide' : 'View'} Details
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setEditing(b); setShowDialog(true); }}>
                Edit
              </Button>
            </div>
          </div>
          {expanded === b.id && <div className="mt-3"><BrokerageRollup brokerage={b} /></div>}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-2">
        <p className="text-sm text-gray-500">
          Firms and companies. A <span className="font-medium text-gray-700">firm partnership</span> is a deal with the whole company; everyone else is an individual partner who works there.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search firms" className="pl-8 h-9 w-44" />
          </div>
          <Button onClick={() => { setEditing(null); setShowDialog(true); }} className="bg-[#013f7c] hover:bg-[#012d5a] text-white gap-2">
            <Plus className="w-4 h-4" /> Add Firm
          </Button>
        </div>
      </div>

      {/* Firm partnerships */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-wide">
          <Handshake className="w-4 h-4 text-[#013f7c]" /> Firm partnerships ({partnerships.length})
        </h3>
        {partnerships.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-gray-500 text-center">
              No firm partnerships yet. Open a firm below and set Partnership to Prospect or Active when you're working on a deal with the whole company.
            </CardContent>
          </Card>
        ) : partnerships.map(renderFirm)}
      </section>

      {/* Firm directory */}
      <section className="space-y-3 pt-2">
        <button
          type="button"
          onClick={() => setShowDirectory(s => !s)}
          className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-wide hover:text-[#013f7c]"
        >
          {showDirectory ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          <Building2 className="w-4 h-4 text-gray-400" /> Firm directory ({directory.length})
        </button>
        {showDirectory && (
          directory.length === 0 ? (
            <p className="text-sm text-gray-400">No firms{q ? ' match your search' : ''}.</p>
          ) : directory.map(renderFirm)
        )}
      </section>

      <BrokerageDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        editing={editing}
      />
    </div>
  );
}
