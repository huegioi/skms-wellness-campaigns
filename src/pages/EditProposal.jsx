import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Download } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { productCatalog } from '@/components/curriculum/catalogData';

export default function EditProposal() {
  const urlParams = new URLSearchParams(window.location.search);
  const proposalId = urlParams.get('id');
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    client_name: '',
    company: '',
    status: 'draft',
    total_amount: 0
  });
  const [customCharges, setCustomCharges] = useState([]);
  const [newChargeLabel, setNewChargeLabel] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');

  const { data: proposal, isLoading } = useQuery({
    queryKey: ['proposal', proposalId],
    queryFn: async () => {
      const proposals = await base44.entities.Proposal.filter({ id: proposalId });
      return proposals[0] || null;
    },
    enabled: !!proposalId
  });

  useEffect(() => {
    if (proposal) {
      setFormData({
        client_name: proposal.client_name || '',
        company: proposal.company || '',
        status: proposal.status || 'draft',
        total_amount: proposal.total_amount || 0
      });
      setCustomCharges(proposal.selections?.customCharges || []);
    }
  }, [proposal]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Proposal.update(proposalId, data),
    onSuccess: () => navigate(createPageUrl('Proposals'))
  });

  const calculateTotal = () => {
    if (!proposal?.selections) return 0;
    const sel = proposal.selections;
    let total = 0;
    
    (sel.workshops || []).forEach(key => {
      total += productCatalog.workshops[key]?.price || 0;
    });
    (sel.challengePrograms || []).forEach(() => {
      total += 1500; // Default challenge price
    });
    (sel.leadership || []).forEach(key => {
      total += productCatalog.leadership[key]?.price || 0;
    });
    (sel.movementClasses || []).forEach(key => {
      total += productCatalog.movementClasses[key]?.price || 0;
    });
    
    const boxes = sel.sampleBoxQuantities || {};
    total += (boxes.reduceStress || 0) * 65;
    total += (boxes.relaxationSleep || 0) * 65;
    total += (boxes.largeEmotional || 0) * 125;
    total += (boxes.largeStressReduction || 0) * 125;
    
    if (sel.customBoxQuantity > 0 && sel.customBoxItems?.length > 0) {
      const customBoxTotal = sel.customBoxItems.reduce((sum, item) => sum + item.price, 0);
      total += customBoxTotal * sel.customBoxQuantity;
    }
    
    customCharges.forEach(charge => {
      total += charge.amount;
    });
    
    return total;
  };

  const addCustomCharge = () => {
    if (newChargeLabel.trim() && newChargeAmount) {
      setCustomCharges([...customCharges, {
        id: Date.now(),
        label: newChargeLabel.trim(),
        amount: parseFloat(newChargeAmount)
      }]);
      setNewChargeLabel('');
      setNewChargeAmount('');
    }
  };

  const removeCustomCharge = (id) => {
    setCustomCharges(customCharges.filter(c => c.id !== id));
  };

  const handleSave = () => {
    const total = calculateTotal();
    updateMutation.mutate({
      ...formData,
      total_amount: total,
      selections: {
        ...proposal.selections,
        customCharges
      }
    });
  };

  const statusColors = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    accepted: 'bg-green-100 text-green-700',
    declined: 'bg-red-100 text-red-700'
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">Loading...</div>;
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Proposal not found</p>
          <Link to={createPageUrl('Proposals')}>
            <Button>Back to Proposals</Button>
          </Link>
        </div>
      </div>
    );
  }

  const selections = proposal.selections || {};

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link to={createPageUrl('Proposals')}>
            <Button variant="outline" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" style={{ color: '#013f7c' }}>Edit Proposal</h1>
            <p className="text-gray-600">Modify proposal details and pricing</p>
          </div>
          <Button onClick={handleSave} className="bg-[#264d44] hover:bg-[#1a3830]">
            <Save className="w-4 h-4 mr-2" /> Save Changes
          </Button>
        </div>

        {/* Client Info */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#264d44' }}>Client Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Client Name</label>
              <Input 
                value={formData.client_name} 
                onChange={(e) => setFormData({...formData, client_name: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Company</label>
              <Input 
                value={formData.company} 
                onChange={(e) => setFormData({...formData, company: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
              <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Selected Items */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#264d44' }}>Selected Items</h2>
          
          {selections.workshops?.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold text-sm text-gray-600 mb-2">Workshops</h3>
              {selections.workshops.map(key => (
                <div key={key} className="flex justify-between py-2 border-b">
                  <span>{productCatalog.workshops[key]?.name}</span>
                  <span className="font-semibold">${productCatalog.workshops[key]?.price?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {selections.challengePrograms?.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold text-sm text-gray-600 mb-2">Challenges</h3>
              {selections.challengePrograms.map(key => (
                <div key={key} className="flex justify-between py-2 border-b">
                  <span>{productCatalog.challenges[key]?.name}</span>
                  <span className="font-semibold">$1,500</span>
                </div>
              ))}
            </div>
          )}

          {selections.leadership?.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold text-sm text-gray-600 mb-2">Leadership Programs</h3>
              {selections.leadership.map(key => (
                <div key={key} className="flex justify-between py-2 border-b">
                  <span>{productCatalog.leadership[key]?.name}</span>
                  <span className="font-semibold">${productCatalog.leadership[key]?.price?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}

          {selections.movementClasses?.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold text-sm text-gray-600 mb-2">Classes</h3>
              {selections.movementClasses.map(key => (
                <div key={key} className="flex justify-between py-2 border-b">
                  <span>{productCatalog.movementClasses[key]?.name}</span>
                  <span className="font-semibold">${productCatalog.movementClasses[key]?.price?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Custom Charges */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#264d44' }}>Additional Charges</h2>
          
          {customCharges.map(charge => (
            <div key={charge.id} className="flex justify-between items-center py-2 border-b">
              <span>{charge.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold">${charge.amount.toLocaleString()}</span>
                <button onClick={() => removeCustomCharge(charge.id)} className="text-red-500 hover:text-red-700">×</button>
              </div>
            </div>
          ))}

          <div className="flex gap-2 mt-4">
            <Input 
              placeholder="Charge label..." 
              value={newChargeLabel} 
              onChange={(e) => setNewChargeLabel(e.target.value)}
              className="flex-1"
            />
            <Input 
              type="number" 
              placeholder="Amount" 
              value={newChargeAmount} 
              onChange={(e) => setNewChargeAmount(e.target.value)}
              className="w-32"
            />
            <Button onClick={addCustomCharge} className="bg-[#264d44]">Add</Button>
          </div>
        </div>

        {/* Total */}
        <div className="bg-gradient-to-r from-[#770142] to-[#441d37] rounded-xl p-6 text-white">
          <div className="flex justify-between items-center">
            <span className="text-xl font-bold">Total Investment</span>
            <span className="text-3xl font-bold">${calculateTotal().toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}