import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus } from 'lucide-react';
import BrokerageDialog from '@/components/partners/BrokerageDialog';
import BrokerageRollup from '@/components/partners/BrokerageRollup';

export default function BrokeragesView({ partners }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expanded, setExpanded] = useState(null);

  const { data: brokerages = [] } = useQuery({
    queryKey: ['brokerages'],
    queryFn: () => base44.entities.Brokerage.list('-created_date')
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">Manage brokerage groups and two-level commission structure</p>
        <Button onClick={() => { setEditing(null); setShowDialog(true); }} className="bg-[#013f7c] hover:bg-[#012d5a] text-white gap-2">
          <Plus className="w-4 h-4" /> Add Brokerage
        </Button>
      </div>

      {brokerages.length === 0 && (
        <Card>
          <CardContent className="text-center py-16">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No brokerages yet. Add your first brokerage to manage a two-level commission structure.</p>
          </CardContent>
        </Card>
      )}

      {brokerages.map(b => {
        const brokerCount = partners.filter(p => p.brokerage_id === b.id && !p.is_demo).length;
        return (
          <Card key={b.id}>
            <CardContent className="pt-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <button
                      onClick={() => setExpanded(expanded === b.id ? null : b.id)}
                      className="font-semibold text-gray-800 text-lg hover:text-[#013f7c] hover:underline transition-colors"
                    >
                      {b.name}
                    </button>
                    <Badge className={b.brokerage_commission_enabled !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                      House: {b.brokerage_commission_enabled !== false ? 'On' : 'Off'}
                    </Badge>
                    <Badge className={b.broker_commission_enabled !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                      Broker: {b.broker_commission_enabled !== false ? 'On' : 'Off'}
                    </Badge>
                  </div>
                  {b.company && <p className="text-gray-500 text-sm">{b.company}</p>}
                  <p className="text-gray-400 text-sm">{brokerCount} broker{brokerCount !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setExpanded(expanded === b.id ? null : b.id)}>
                    {expanded === b.id ? 'Hide' : 'View'} Details
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setEditing(b); setShowDialog(true); }}>
                    Edit
                  </Button>
                </div>
              </div>
              {expanded === b.id && <BrokerageRollup brokerage={b} />}
            </CardContent>
          </Card>
        );
      })}

      <BrokerageDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        editing={editing}
      />
    </div>
  );
}