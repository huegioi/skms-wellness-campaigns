import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Save, Download, Plus, Minus, X, Sparkles, RefreshCw } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { productCatalog, workforceChallenges } from '@/components/curriculum/catalogData';
import { calculateChallengePrice } from '@/components/curriculum/pricingUtils';
import { markTaskComplete, createDefaultTasksForClient } from '@/components/tasks/taskTemplates';

export default function EditProposal() {
  const urlParams = new URLSearchParams(window.location.search);
  const proposalId = urlParams.get('id');
  const isNewProposal = !proposalId;
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    client_id: '',
    client_name: '',
    company: '',
    status: 'draft',
    narrative_summary: ''
  });
  
  const [selections, setSelections] = useState({
    workshops: [],
    challengePrograms: [],
    leadership: [],
    movementClasses: [],
    sampleBoxQuantities: { reduceStress: 0, relaxationSleep: 0, largeEmotional: 0, largeStressReduction: 0 },
    customBoxQuantity: 0,
    customBoxItems: [],
    challenges: [],
    assessmentData: {}
  });
  
  const [priceOverrides, setPriceOverrides] = useState({});
  const [customCharges, setCustomCharges] = useState([]);
  const [newChargeLabel, setNewChargeLabel] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

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
        client_id: proposal.client_id || '',
        client_name: proposal.client_name || '',
        company: proposal.company || '',
        status: proposal.status || 'draft',
        narrative_summary: proposal.narrative_summary || ''
      });
      setSelections({
        workshops: proposal.selections?.workshops || [],
        challengePrograms: proposal.selections?.challengePrograms || [],
        leadership: proposal.selections?.leadership || [],
        movementClasses: proposal.selections?.movementClasses || [],
        sampleBoxQuantities: proposal.selections?.sampleBoxQuantities || { reduceStress: 0, relaxationSleep: 0, largeEmotional: 0, largeStressReduction: 0 },
        customBoxQuantity: proposal.selections?.customBoxQuantity || 0,
        customBoxItems: proposal.selections?.customBoxItems || [],
        challenges: proposal.selections?.challenges || [],
        assessmentData: proposal.selections?.assessmentData || {}
      });
      setPriceOverrides(proposal.selections?.priceOverrides || {});
      setCustomCharges(proposal.selections?.customCharges || []);
    }
  }, [proposal]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (isNewProposal) {
        return base44.entities.Proposal.create(data);
      }
      return base44.entities.Proposal.update(proposalId, data);
    },
    onSuccess: async (savedProposal, variables) => {
      // Auto-mark tasks when proposal status changes
      if (proposal && proposal.client_id) {
        if (variables.status === 'sent' && proposal.status !== 'sent') {
          await markTaskComplete(base44, proposal.client_id, 'Send or Accept Proposal', 'proposal_sent', proposalId);
        }
        if (variables.status === 'accepted' && proposal.status !== 'accepted') {
          // Create tasks if they don't exist
          const existingTasks = await base44.entities.ClientTask.filter({ client_id: proposal.client_id });
          if (existingTasks.length === 0) {
            await createDefaultTasksForClient(base44, proposal.client_id, proposal.client_name);
          }
          // Mark proposal as accepted
          await markTaskComplete(base44, proposal.client_id, 'Send or Accept Proposal', 'proposal_accepted', proposalId);
        }
      }
      navigate(createPageUrl('Proposals'));
    }
  });

  // Look up service name from enriched data stored on proposal, or fall back to static catalog
  const getServiceName = (category, key) => {
    const dataKey = `${category === 'workshops' ? 'workshops' : category === 'challenges' ? 'challengePrograms' : category}Data`;
    const enriched = (selections[dataKey] || []).find(s => s.id === key);
    if (enriched) return enriched.name;
    if (category === 'workshops') return productCatalog.workshops[key]?.name || key;
    if (category === 'challenges') return productCatalog.challenges[key]?.name || key;
    if (category === 'leadership') return productCatalog.leadership[key]?.name || key;
    if (category === 'movementClasses') return productCatalog.movementClasses[key]?.name || key;
    return key;
  };

  const getPrice = (category, key) => {
    const overrideKey = `${category}_${key}`;
    if (priceOverrides[overrideKey] !== undefined) return priceOverrides[overrideKey];
    // Check enriched data first (from builder)
    const dataKey = `${category === 'workshops' ? 'workshops' : category === 'challenges' ? 'challengePrograms' : category}Data`;
    const enriched = (selections[dataKey] || []).find(s => s.id === key);
    if (enriched?.price) return enriched.price;
    if (category === 'workshops') return productCatalog.workshops[key]?.price || 0;
    if (category === 'challenges') {
      const savedPrice = selections.challengePrice;
      if (savedPrice) return savedPrice;
      const companySize = selections.assessmentData?.companySize;
      return calculateChallengePrice(companySize);
    }
    if (category === 'leadership') return productCatalog.leadership[key]?.price || 0;
    if (category === 'movementClasses') return productCatalog.movementClasses[key]?.price || 0;
    return 0;
  };

  const setPrice = (category, key, value) => {
    const overrideKey = `${category}_${key}`;
    setPriceOverrides(prev => ({ ...prev, [overrideKey]: parseFloat(value) || 0 }));
  };

  const toggleItem = (category, key) => {
    setSelections(prev => {
      const current = prev[category] || [];
      if (current.includes(key)) {
        return { ...prev, [category]: current.filter(k => k !== key) };
      }
      return { ...prev, [category]: [...current, key] };
    });
  };

  const updateBoxQuantity = (boxType, increment) => {
    setSelections(prev => ({
      ...prev,
      sampleBoxQuantities: {
        ...prev.sampleBoxQuantities,
        [boxType]: increment ? (prev.sampleBoxQuantities[boxType] || 0) + 1 : Math.max(0, (prev.sampleBoxQuantities[boxType] || 0) - 1)
      }
    }));
  };

  const calculateTotal = () => {
    let total = 0;
    selections.workshops.forEach(key => total += getPrice('workshops', key));
    selections.challengePrograms.forEach(key => total += getPrice('challenges', key));
    selections.leadership.forEach(key => total += getPrice('leadership', key));
    selections.movementClasses.forEach(key => total += getPrice('movementClasses', key));
    
    const boxes = selections.sampleBoxQuantities;
    total += (boxes.reduceStress || 0) * 65;
    total += (boxes.relaxationSleep || 0) * 65;
    total += (boxes.largeEmotional || 0) * 125;
    total += (boxes.largeStressReduction || 0) * 125;
    
    if (selections.customBoxQuantity > 0 && selections.customBoxItems?.length > 0) {
      const customBoxTotal = selections.customBoxItems.reduce((sum, item) => sum + item.price, 0);
      total += customBoxTotal * selections.customBoxQuantity;
    }
    
    customCharges.forEach(charge => total += charge.amount);
    return total;
  };

  const addCustomCharge = () => {
    if (newChargeLabel.trim() && newChargeAmount) {
      setCustomCharges([...customCharges, { id: Date.now(), label: newChargeLabel.trim(), amount: parseFloat(newChargeAmount) }]);
      setNewChargeLabel('');
      setNewChargeAmount('');
    }
  };

  const generateNarrativeSummary = () => {
    const parts = [];
    
    if (selections.workshops.length > 0) {
      const workshopNames = selections.workshops.map(k => productCatalog.workshops[k]?.name).filter(Boolean);
      parts.push(`interactive workshops including ${workshopNames.slice(0, 3).join(', ')}${workshopNames.length > 3 ? ' and more' : ''} to build essential mental fitness skills`);
    }
    
    if (selections.challengePrograms.length > 0) {
      const challengeNames = selections.challengePrograms.map(k => productCatalog.challenges[k]?.name).filter(Boolean);
      parts.push(`engaging 14-day challenges such as ${challengeNames.slice(0, 2).join(' and ')} to reinforce healthy habits and team engagement`);
    }
    
    if (selections.leadership.length > 0) {
      const leadershipNames = selections.leadership.map(k => productCatalog.leadership[k]?.name).filter(Boolean);
      parts.push(`specialized leadership development through ${leadershipNames.join(' and ')} to equip managers with emotional intelligence and people management skills`);
    }
    
    if (selections.movementClasses.length > 0) {
      const classNames = selections.movementClasses.map(k => productCatalog.movementClasses[k]?.name).filter(Boolean);
      parts.push(`ongoing wellness classes including ${classNames.slice(0, 2).join(' and ')} to support physical and mental well-being`);
    }
    
    const boxes = selections.sampleBoxQuantities;
    const totalBoxes = (boxes.reduceStress || 0) + (boxes.relaxationSleep || 0) + (boxes.largeEmotional || 0) + (boxes.largeStressReduction || 0);
    if (totalBoxes > 0) {
      parts.push(`curated wellness boxes as thoughtful incentives to encourage participation and self-care`);
    }
    
    if (parts.length === 0) {
      return `This customized mental fitness program is designed to support ${formData.company || 'your organization'}'s team well-being goals. Select services above to generate a tailored narrative.`;
    }
    
    const intro = `This customized mental fitness campaign is designed to support ${formData.company || 'your organization'}'s workforce well-being and productivity goals.`;
    const body = `The program includes ${parts.join('; ')}.`;
    const outro = `Together, these elements create a comprehensive approach to building resilience, reducing stress, and fostering a healthier, more engaged workplace culture.`;
    
    return `${intro}\n\n${body}\n\n${outro}`;
  };

  const handleGenerateNarrative = () => {
    const narrative = generateNarrativeSummary();
    setFormData(prev => ({ ...prev, narrative_summary: narrative }));
  };

  const handleClientSelect = (clientId) => {
    const selectedClient = clients.find(c => c.id === clientId);
    if (selectedClient) {
      setFormData({
        ...formData,
        client_id: clientId,
        client_name: selectedClient.name,
        client_email: selectedClient.email,
        company: selectedClient.company || ''
      });
    }
  };

  const handleSave = () => {
    if (isNewProposal && !formData.client_id) {
      alert('Please select a client first');
      return;
    }

    saveMutation.mutate({
      ...formData,
      total_amount: calculateTotal(),
      selections: { ...selections, priceOverrides, customCharges }
    });
  };

  const generatePDF = () => {
    const pdfContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Mental Fitness Campaign Proposal - ${formData.client_name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; background: #fff; color: #333; line-height: 1.6; }
          .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 3px solid #013f7c; }
          h1 { color: #013f7c; font-size: 32px; margin-bottom: 10px; }
          .subtitle { color: #666; font-size: 16px; }
          .section { margin-bottom: 30px; page-break-inside: avoid; }
          .section-title { color: #013f7c; font-size: 20px; font-weight: 700; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #cae5e3; }
          .item { margin-bottom: 20px; padding: 15px; background: #f9f9f9; border-radius: 8px; }
          .item-title { color: #264d44; font-weight: 700; font-size: 16px; margin-bottom: 5px; }
          .item-price { color: #770142; font-weight: 700; margin-bottom: 8px; }
          .item-description { color: #555; font-size: 14px; line-height: 1.5; }
          .total-box { background: linear-gradient(135deg, #770142, #441d37); color: white; padding: 25px; border-radius: 12px; margin-top: 30px; text-align: center; }
          .total-amount { font-size: 36px; font-weight: 700; margin: 10px 0; }
          .contact-info { background: #f4f0e9; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
          .contact-row { margin-bottom: 8px; }
          .contact-label { font-weight: 700; color: #264d44; display: inline-block; width: 120px; }
          @media print { body { padding: 20px; } .section { page-break-inside: avoid; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Mental Fitness Campaign Proposal</h1>
          <div class="subtitle">Prepared by SkillfulMeans</div>
        </div>
        <div class="contact-info">
          <div class="contact-row"><span class="contact-label">Prepared For:</span> ${formData.client_name}</div>
          ${formData.company ? `<div class="contact-row"><span class="contact-label">Company:</span> ${formData.company}</div>` : ''}
          <div class="contact-row"><span class="contact-label">Date:</span> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
        </div>

        ${formData.narrative_summary ? `
          <div class="section" style="background: linear-gradient(135deg, rgba(119, 1, 66, 0.08), rgba(1, 63, 124, 0.08)); border-left: 4px solid #770142; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <div class="section-title" style="border-bottom: none; color: #770142;">Program Overview</div>
            <p style="color: #333; line-height: 1.8; white-space: pre-line;">${formData.narrative_summary}</p>
          </div>
        ` : ''}

        ${selections.workshops.length > 0 ? `
          <div class="section">
            <div class="section-title">Workshops (${selections.workshops.length})</div>
            ${selections.workshops.map(key => {
              const workshop = productCatalog.workshops[key];
              return workshop ? `<div class="item"><div class="item-title">${workshop.name}</div><div class="item-price">$${getPrice('workshops', key).toLocaleString()}</div><div class="item-description">${workshop.description}</div></div>` : '';
            }).join('')}
          </div>
        ` : ''}

        ${selections.challengePrograms.length > 0 ? `
          <div class="section">
            <div class="section-title">14-Day Challenges (${selections.challengePrograms.length})</div>
            ${selections.challengePrograms.map(key => {
              const challenge = productCatalog.challenges[key];
              return challenge ? `<div class="item"><div class="item-title">${challenge.name}</div><div class="item-price">$${getPrice('challenges', key).toLocaleString()}</div><div class="item-description">${challenge.description}</div></div>` : '';
            }).join('')}
          </div>
        ` : ''}

        ${selections.leadership.length > 0 ? `
          <div class="section">
            <div class="section-title">Leadership Programs (${selections.leadership.length})</div>
            ${selections.leadership.map(key => {
              const program = productCatalog.leadership[key];
              return program ? `<div class="item"><div class="item-title">${program.name}</div><div class="item-price">$${getPrice('leadership', key).toLocaleString()}</div><div class="item-description">${program.description}</div></div>` : '';
            }).join('')}
          </div>
        ` : ''}

        ${selections.movementClasses.length > 0 ? `
          <div class="section">
            <div class="section-title">Classes (${selections.movementClasses.length})</div>
            ${selections.movementClasses.map(key => {
              const classItem = productCatalog.movementClasses[key];
              return classItem ? `<div class="item"><div class="item-title">${classItem.name}</div><div class="item-price">$${getPrice('movementClasses', key).toLocaleString()}</div><div class="item-description">${classItem.description}</div></div>` : '';
            }).join('')}
          </div>
        ` : ''}

        ${(() => {
          const boxes = selections.sampleBoxQuantities;
          const hasBoxes = boxes && ((boxes.reduceStress || 0) + (boxes.relaxationSleep || 0) + (boxes.largeEmotional || 0) + (boxes.largeStressReduction || 0) > 0);
          if (!hasBoxes) return '';
          return `
            <div class="section">
              <div class="section-title">Wellness Boxes</div>
              ${boxes.reduceStress > 0 ? `<div class="item"><div class="item-title">Reduce Stress Boxes (${boxes.reduceStress})</div><div class="item-price">${boxes.reduceStress} × $65 = $${(boxes.reduceStress * 65).toLocaleString()}</div></div>` : ''}
              ${boxes.relaxationSleep > 0 ? `<div class="item"><div class="item-title">Relaxation & Sleep Boxes (${boxes.relaxationSleep})</div><div class="item-price">${boxes.relaxationSleep} × $65 = $${(boxes.relaxationSleep * 65).toLocaleString()}</div></div>` : ''}
              ${boxes.largeEmotional > 0 ? `<div class="item"><div class="item-title">Large Emotional Wellness Boxes (${boxes.largeEmotional})</div><div class="item-price">${boxes.largeEmotional} × $125 = $${(boxes.largeEmotional * 125).toLocaleString()}</div></div>` : ''}
              ${boxes.largeStressReduction > 0 ? `<div class="item"><div class="item-title">Large Stress Reduction Boxes (${boxes.largeStressReduction})</div><div class="item-price">${boxes.largeStressReduction} × $125 = $${(boxes.largeStressReduction * 125).toLocaleString()}</div></div>` : ''}
            </div>
          `;
        })()}

        ${customCharges.length > 0 ? `
          <div class="section">
            <div class="section-title">Additional Charges</div>
            ${customCharges.map(charge => `<div class="item"><div class="item-title">${charge.label}</div><div class="item-price">$${charge.amount.toLocaleString()}</div></div>`).join('')}
          </div>
        ` : ''}

        <div class="total-box">
          <div style="font-size: 18px; margin-bottom: 10px;">Estimated Total Investment</div>
          <div class="total-amount">$${calculateTotal().toLocaleString()}</div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([pdfContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Proposal-${formData.client_name.replace(/\s+/g, '-')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">Loading...</div>;
  }

  if (!isNewProposal && !proposal) {
    return (
      <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Proposal not found</p>
          <Link to={createPageUrl('Proposals')}><Button>Back to Proposals</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8 flex-wrap">
          <Link to={createPageUrl('Proposals')}>
            <Button variant="outline" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold" style={{ color: '#013f7c' }}>
              {isNewProposal ? 'New Proposal' : 'Edit Proposal'}
            </h1>
          </div>
          {!isNewProposal && (
            <Button variant="outline" onClick={generatePDF}><Download className="w-4 h-4 mr-2" /> Download</Button>
          )}
          <Button onClick={handleSave} className="bg-[#264d44] hover:bg-[#1a3830]" disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" /> {saveMutation.isPending ? 'Saving...' : (isNewProposal ? 'Create' : 'Save')}
          </Button>
        </div>

        {/* Client Info */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#264d44' }}>Client Information</h2>
          {isNewProposal && !formData.client_id && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <label className="block text-sm font-semibold text-blue-900 mb-2">Select Client *</label>
              <Select onValueChange={handleClientSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name} {client.company ? `- ${client.company}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Client Name</label>
              <Input 
                value={formData.client_name} 
                onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                disabled={isNewProposal && !formData.client_id}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Company</label>
              <Input 
                value={formData.company} 
                onChange={(e) => setFormData({...formData, company: e.target.value})}
                disabled={isNewProposal && !formData.client_id}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
              <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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

        {/* Narrative Summary */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" style={{ color: '#770142' }} />
              <h2 className="text-lg font-bold" style={{ color: '#264d44' }}>Program Narrative</h2>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleGenerateNarrative}
              className="text-[#770142] border-[#770142] hover:bg-[#770142] hover:text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Auto-Generate
            </Button>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            This narrative will appear in the proposal download and sent emails. Edit it to customize the message for your client.
          </p>
          <Textarea 
            value={formData.narrative_summary} 
            onChange={(e) => setFormData({...formData, narrative_summary: e.target.value})}
            placeholder="Click 'Auto-Generate' to create a narrative based on selected services, or write your own..."
            rows={6}
            className="resize-y"
          />
        </div>

        {/* Workshops */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#264d44' }}>Workshops</h2>
          <div className="space-y-3">
            {Object.entries(productCatalog.workshops).map(([key, workshop]) => (
              <div key={key} className={`flex items-center gap-4 p-3 rounded-lg border ${selections.workshops.includes(key) ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                <Checkbox checked={selections.workshops.includes(key)} onCheckedChange={() => toggleItem('workshops', key)} />
                <div className="flex-1">
                  <p className="font-medium">{getServiceName('workshops', key)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">$</span>
                  <Input 
                    type="number" 
                    className="w-24" 
                    value={getPrice('workshops', key)} 
                    onChange={(e) => setPrice('workshops', key, e.target.value)}
                  />
                </div>
              </div>
            ))}
            {/* Show any services from the builder that aren't in the static catalog */}
            {(selections.workshopsData || []).filter(s => !productCatalog.workshops[s.id]).map(svc => (
              <div key={svc.id} className={`flex items-center gap-4 p-3 rounded-lg border ${selections.workshops.includes(svc.id) ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                <Checkbox checked={selections.workshops.includes(svc.id)} onCheckedChange={() => toggleItem('workshops', svc.id)} />
                <div className="flex-1">
                  <p className="font-medium">{svc.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">$</span>
                  <Input type="number" className="w-24" value={getPrice('workshops', svc.id)} onChange={(e) => setPrice('workshops', svc.id, e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Challenges */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#264d44' }}>14-Day Challenges</h2>
          <div className="space-y-3">
            {Object.entries(productCatalog.challenges).map(([key, challenge]) => (
              <div key={key} className={`flex items-center gap-4 p-3 rounded-lg border ${selections.challengePrograms.includes(key) ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                <Checkbox checked={selections.challengePrograms.includes(key)} onCheckedChange={() => toggleItem('challengePrograms', key)} />
                <div className="flex-1">
                  <p className="font-medium">{challenge.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">$</span>
                  <Input 
                    type="number" 
                    className="w-24" 
                    value={getPrice('challenges', key)} 
                    onChange={(e) => setPrice('challenges', key, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leadership */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#264d44' }}>Leadership Programs</h2>
          <div className="space-y-3">
            {Object.entries(productCatalog.leadership).map(([key, program]) => (
              <div key={key} className={`flex items-center gap-4 p-3 rounded-lg border ${selections.leadership.includes(key) ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                <Checkbox checked={selections.leadership.includes(key)} onCheckedChange={() => toggleItem('leadership', key)} />
                <div className="flex-1">
                  <p className="font-medium">{program.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">$</span>
                  <Input 
                    type="number" 
                    className="w-24" 
                    value={getPrice('leadership', key)} 
                    onChange={(e) => setPrice('leadership', key, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Classes */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#264d44' }}>Classes</h2>
          <div className="space-y-3">
            {Object.entries(productCatalog.movementClasses).map(([key, classItem]) => (
              <div key={key} className={`flex items-center gap-4 p-3 rounded-lg border ${selections.movementClasses.includes(key) ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                <Checkbox checked={selections.movementClasses.includes(key)} onCheckedChange={() => toggleItem('movementClasses', key)} />
                <div className="flex-1">
                  <p className="font-medium">{classItem.name}</p>
                  <p className="text-sm text-gray-500">{classItem.duration}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">$</span>
                  <Input 
                    type="number" 
                    className="w-24" 
                    value={getPrice('movementClasses', key)} 
                    onChange={(e) => setPrice('movementClasses', key, e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Wellness Boxes */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#264d44' }}>Wellness Boxes</h2>
          <div className="space-y-3">
            {[
              { key: 'reduceStress', name: 'Reduce Stress Box', price: 65 },
              { key: 'relaxationSleep', name: 'Relaxation & Sleep Box', price: 65 },
              { key: 'largeEmotional', name: 'Large Emotional Wellness Box', price: 125 },
              { key: 'largeStressReduction', name: 'Large Stress Reduction Box', price: 125 }
            ].map(box => (
              <div key={box.key} className="flex items-center gap-4 p-3 rounded-lg border bg-gray-50">
                <div className="flex-1">
                  <p className="font-medium">{box.name}</p>
                  <p className="text-sm text-gray-500">${box.price} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" onClick={() => updateBoxQuantity(box.key, false)}><Minus className="w-4 h-4" /></Button>
                  <span className="w-12 text-center font-semibold">{selections.sampleBoxQuantities[box.key] || 0}</span>
                  <Button size="icon" variant="outline" onClick={() => updateBoxQuantity(box.key, true)}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Charges */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#264d44' }}>Additional Charges</h2>
          {customCharges.map(charge => (
            <div key={charge.id} className="flex justify-between items-center py-2 border-b">
              <span>{charge.label}</span>
              <div className="flex items-center gap-2">
                <span className="font-semibold">${charge.amount.toLocaleString()}</span>
                <Button size="icon" variant="ghost" className="text-red-500" onClick={() => setCustomCharges(customCharges.filter(c => c.id !== charge.id))}><X className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-4">
            <Input placeholder="Charge label..." value={newChargeLabel} onChange={(e) => setNewChargeLabel(e.target.value)} className="flex-1" />
            <Input type="number" placeholder="Amount" value={newChargeAmount} onChange={(e) => setNewChargeAmount(e.target.value)} className="w-32" />
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