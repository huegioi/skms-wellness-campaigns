import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, Link2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ConvertReferralToClientDialog({ referral, open, onOpenChange, onSuccess }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState('new');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientFields, setClientFields] = useState({ name: '', email: '', company: '' });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date')
  });

  useEffect(() => {
    if (referral) {
      setClientFields({
        name: referral.contact_name || '',
        email: referral.contact_email || '',
        company: referral.company_name || '',
      });
      setMode('new');
      setSelectedClientId('');
    }
  }, [referral]);

  const convertMutation = useMutation({
    mutationFn: (payload) => base44.functions.invoke('convertReferralToClient', payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['referrals'] });
      queryClient.invalidateQueries({ queryKey: ['referralPartners'] });
      toast.success('Converted to client!');
      onOpenChange(false);
      if (onSuccess) onSuccess(res.data);
    },
    onError: (err) => {
      const msg = err.response?.data?.error || err.message || 'Unknown error';
      toast.error('Conversion failed: ' + msg);
    }
  });

  const handleConvert = () => {
    const payload = { referral_id: referral.id };
    if (mode === 'existing' && selectedClientId) {
      payload.existing_client_id = selectedClientId;
    } else {
      payload.client_fields = {
        name: clientFields.name,
        email: clientFields.email,
        company: clientFields.company,
      };
    }
    convertMutation.mutate(payload);
  };

  if (!referral) return null;

  const canSubmit = !convertMutation.isPending && (
    mode === 'existing' ? !!selectedClientId : !!clientFields.name && !!clientFields.email
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#013f7c]">
            <UserPlus className="w-5 h-5" />
            Convert to Client
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <p className="font-medium text-blue-800">{referral.company_name || referral.contact_name}</p>
            <p className="text-blue-600 text-xs mt-0.5">Referred by {referral.referral_partner_name}</p>
          </div>

          <Tabs value={mode} onValueChange={setMode}>
            <TabsList className="w-full">
              <TabsTrigger value="new" className="flex-1"><UserPlus className="w-3.5 h-3.5 mr-1.5" /> New Client</TabsTrigger>
              <TabsTrigger value="existing" className="flex-1"><Link2 className="w-3.5 h-3.5 mr-1.5" /> Link Existing</TabsTrigger>
            </TabsList>
            <TabsContent value="new" className="space-y-3 mt-3">
              <Input placeholder="Contact Name *" value={clientFields.name} onChange={e => setClientFields({ ...clientFields, name: e.target.value })} />
              <Input type="email" placeholder="Contact Email *" value={clientFields.email} onChange={e => setClientFields({ ...clientFields, email: e.target.value })} />
              <Input placeholder="Company Name" value={clientFields.company} onChange={e => setClientFields({ ...clientFields, company: e.target.value })} />
            </TabsContent>
            <TabsContent value="existing" className="space-y-3 mt-3">
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger><SelectValue placeholder="Select existing client..." /></SelectTrigger>
                <SelectContent>
                  {clients.filter(c => c.company || c.name).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">The referral partner will be linked to this client.</p>
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 pt-2">
            <Button className="flex-1 bg-[#264d44] hover:bg-[#1a3830]" onClick={handleConvert} disabled={!canSubmit}>
              {convertMutation.isPending ? 'Converting...' : 'Convert to Client'}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}