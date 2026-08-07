import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Save, Download, Plus, Minus, X, Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { enumToApproxCount } from '@/components/curriculum/pricingUtils';
import { calcPricing } from '@/components/curriculum/ChallengePricingEstimator';
import { findMatchedStage, formatStageLabel } from '@/lib/rateCard';
import { WELLNESS_BOX_PRICES, BOX_KEY_TO_SERVICE_NAME, BOX_DISPLAY_NAMES, resolveBoxPrices, applyBoxFloor, customBoxUnitPrice } from '@/lib/wellnessBoxes';

// Snapshot-first box price lookup: proposal snapshot → live Service → constant → 0
const getBoxPrice = (key, snapshot, livePrices) =>
  applyBoxFloor(key,
    (snapshot && snapshot[key] != null) ? snapshot[key]
    : (livePrices && livePrices[key] != null) ? livePrices[key]
    : (WELLNESS_BOX_PRICES[key] || 0)
  );
import { markTaskComplete, createDefaultTasksForClient } from '@/components/tasks/taskTemplates';
import { htmlToPdfDownload, proposalFilename } from '@/lib/proposalPdf';

export default function EditProposal() {
  const [searchParams] = useSearchParams();
  const proposalId = searchParams.get('id');
  const preloadClientId = searchParams.get('clientId');
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
    sampleBoxQuantities: { reduceStress: 0, relaxationSleep: 0, largeEmotional: 0, largeStressReduction: 0, stressReductionDigital: 0, beyondBurnoutDigital: 0, emotionalWellness: 0, wintertimeHealthy: 0, newYearFreshStart: 0 },
    customBoxQuantity: 0,
    customBoxItems: [],
    assessmentData: {}
  });
  
  const [priceOverrides, setPriceOverrides] = useState({});
  const [customCharges, setCustomCharges] = useState([]);
  const [newChargeLabel, setNewChargeLabel] = useState('');
  const [newChargeAmount, setNewChargeAmount] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const { data: services = [], isLoading: isLoadingServices } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list('sort_order')
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
    if (preloadClientId && isNewProposal && clients.length > 0 && !formData.client_id) {
      handleClientSelect(preloadClientId);
    }
  }, [preloadClientId, clients]);

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
        ...(proposal.selections || {}),
        workshops: proposal.selections?.workshops || [],
        challengePrograms: proposal.selections?.challengePrograms || [],
        leadership: proposal.selections?.leadership || [],
        movementClasses: proposal.selections?.movementClasses || [],
        sampleBoxQuantities: proposal.selections?.sampleBoxQuantities || { reduceStress: 0, relaxationSleep: 0, largeEmotional: 0, largeStressReduction: 0, stressReductionDigital: 0, beyondBurnoutDigital: 0, emotionalWellness: 0, wintertimeHealthy: 0, newYearFreshStart: 0 },
        customBoxQuantity: proposal.selections?.customBoxQuantity || 0,
        customBoxItems: proposal.selections?.customBoxItems || [],
        assessmentData: proposal.selections?.assessmentData || {},
        challengePrice: proposal.selections?.challengePrice || null,
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
      if (isNewProposal) {
        navigate(createPageUrl('EditProposal') + `?id=${savedProposal.id}`);
        return;
      }
      if (proposal && proposal.client_id) {
        if (variables.status === 'sent' && proposal.status !== 'sent') {
          await markTaskComplete(base44, proposal.client_id, 'Send or Accept Proposal', 'proposal_sent', proposalId);
        }
        if (variables.status === 'accepted' && proposal.status !== 'accepted') {
          const existingTasks = await base44.entities.ClientTask.filter({ client_id: proposal.client_id });
          if (existingTasks.length === 0) {
            await createDefaultTasksForClient(base44, proposal.client_id, proposal.client_name, savedProposal);
          }
          await markTaskComplete(base44, proposal.client_id, 'Send or Accept Proposal', 'proposal_accepted', proposalId);
          try {
            const res = await base44.functions.invoke('autoAdvanceClientStage', { trigger: 'proposal_accepted', proposal_id: proposalId });
            if (res.data?.transitioned) {
              toast.success('Client stage → New Client Setup', {
                description: `${res.data.client_name} auto-advanced from ${res.data.from_stage || 'empty'}.`,
              });
            }
          } catch { /* non-fatal */ }
          // Unlock assessment lead → normal queues/metrics/renewal + log partner activity
          try {
            await base44.functions.invoke('unlockAssessmentLead', { client_id: proposal.client_id });
          } catch { /* non-fatal */ }
        }
      }
      setIsDirty(false);
    }
  });

  // Helper: get services by their entity category
  const getServicesByCategory = (category) => {
    return services.filter(s => s.category === category && s.is_active !== false);
  };

  // Build a lookup map for fast access by ID
  const serviceMap = React.useMemo(() => {
    const map = {};
    services.forEach(s => { map[s.id] = s; });
    return map;
  }, [services]);

  // Get price for a service: overrides → *Data snapshot → challengePrice → live Service.price → 0
  // Snapshot-first so a proposal quoted months ago keeps its original prices.
  const getPrice = (serviceId) => {
    if (priceOverrides[serviceId] !== undefined) return priceOverrides[serviceId];
    // Snapshot from the proposal's *Data arrays (preserved across saves)
    const snapshotEntry =
      (selections.workshopsData || []).find(x => x.id === serviceId) ||
      (selections.leadershipData || []).find(x => x.id === serviceId) ||
      (selections.movementClassesData || []).find(x => x.id === serviceId);
    if (snapshotEntry && snapshotEntry.price > 0) return snapshotEntry.price;
    const service = services.find(s => s.id === serviceId);
    if (service?.category === 'challenge') return challengePrice;
    return service?.price || 0;
  };

  const setPrice = (serviceId, value) => {
    setIsDirty(true);
    setPriceOverrides(prev => ({ ...prev, [serviceId]: parseFloat(value) || 0 }));
  };

  const toggleItem = (category, id) => {
    setIsDirty(true);
    setSelections(prev => {
      const current = prev[category] || [];
      if (current.includes(id)) {
        return { ...prev, [category]: current.filter(k => k !== id) };
      }
      return { ...prev, [category]: [...current, id] };
    });
  };

  const updateBoxQuantity = (boxType, increment) => {
    setIsDirty(true);
    setSelections(prev => ({
      ...prev,
      sampleBoxQuantities: {
        ...prev.sampleBoxQuantities,
        [boxType]: increment ? (prev.sampleBoxQuantities[boxType] || 0) + 1 : Math.max(0, (prev.sampleBoxQuantities[boxType] || 0) - 1)
      }
    }));
  };

  // Canonical challenge pricing — null when no headcount (manual form never falls back to $1,500).
  const challengePricing = useMemo(() => calcPricing(parseInt(selections.assessmentData?.companySize, 10)), [selections.assessmentData?.companySize]);
  const challengePrice = challengePricing ? challengePricing.totalCost : null;

  const matchedStageLabel = useMemo(() => {
    const workshopCount = (selections.workshops || []).length;
    const challengeCount = (selections.challengePrograms || []).length;
    const hasLeadership = (selections.leadership || []).length > 0;
    if (workshopCount === 0 && challengeCount === 0 && !hasLeadership) {
      return proposal?.matched_stage || '';
    }
    const stage = findMatchedStage({ workshopCount, challengeCount, hasLeadership });
    return formatStageLabel(stage);
  }, [selections.workshops, selections.challengePrograms, selections.leadership, proposal?.matched_stage]);

  const calculateTotal = () => {
    let total = 0;
    selections.workshops.forEach(id => total += getPrice(id));
    selections.challengePrograms.forEach(id => {
      const override = priceOverrides[id];
      if (override !== undefined) total += override;
      else if (challengePrice != null) total += challengePrice;
    });
    selections.leadership.forEach(id => total += getPrice(id));
    selections.movementClasses.forEach(id => total += getPrice(id));
    
    const boxes = selections.sampleBoxQuantities;
    const { prices: boxPrices } = resolveBoxPrices(services);
    const boxSnapshot = selections.sampleBoxPrices;
    Object.entries(boxes).forEach(([key, qty]) => { total += (qty || 0) * getBoxPrice(key, boxSnapshot, boxPrices); });
    
    if (selections.customBoxQuantity > 0 && selections.customBoxItems?.length > 0) {
      const customBoxTotal = customBoxUnitPrice(selections.customBoxItems);
      total += customBoxTotal * selections.customBoxQuantity;
    }
    
    customCharges.forEach(charge => total += charge.amount);
    return total;
  };

  const addCustomCharge = () => {
    if (newChargeLabel.trim() && newChargeAmount) {
      setIsDirty(true);
      setCustomCharges([...customCharges, { id: Date.now(), label: newChargeLabel.trim(), amount: parseFloat(newChargeAmount) }]);
      setNewChargeLabel('');
      setNewChargeAmount('');
    }
  };

  const generateNarrativeSummary = () => {
    const getName = (id) => services.find(s => s.id === id)?.name || id;
    const parts = [];
    
    if (selections.workshops.length > 0) {
      const names = selections.workshops.map(getName).filter(Boolean);
      parts.push(`interactive workshops including ${names.slice(0, 3).join(', ')}${names.length > 3 ? ' and more' : ''} to build essential mental fitness skills`);
    }
    if (selections.challengePrograms.length > 0) {
      const names = selections.challengePrograms.map(getName).filter(Boolean);
      parts.push(`engaging 14-day challenges such as ${names.slice(0, 2).join(' and ')} to reinforce healthy habits and team engagement`);
    }
    if (selections.leadership.length > 0) {
      const names = selections.leadership.map(getName).filter(Boolean);
      parts.push(`specialized leadership development through ${names.join(' and ')} to equip managers with emotional intelligence and people management skills`);
    }
    if (selections.movementClasses.length > 0) {
      const names = selections.movementClasses.map(getName).filter(Boolean);
      parts.push(`ongoing wellness classes including ${names.slice(0, 2).join(' and ')} to support physical and mental well-being`);
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
    setFormData(prev => ({ ...prev, narrative_summary: generateNarrativeSummary() }));
  };

  const handleClientSelect = (clientId) => {
    const selectedClient = clients.find(c => c.id === clientId);
    if (selectedClient) {
      const companySize = selectedClient.employee_count || enumToApproxCount(selectedClient.company_size) || '';
      setFormData({
        ...formData,
        client_id: clientId,
        client_name: selectedClient.name,
        client_email: selectedClient.email,
        company: selectedClient.company || ''
      });
      setSelections(prev => ({
        ...prev,
        assessmentData: { ...(prev.assessmentData || {}), companySize }
      }));
      setIsDirty(true);
    }
  };

  const markDirty = () => setIsDirty(true);

  const handleSave = () => {
    if (isNewProposal && !formData.client_id) {
      alert('Please select a client first');
      return;
    }
    // Write headcount back to the Client record (matches ReviewStep behavior)
    const companySize = selections.assessmentData?.companySize;
    const headcount = parseInt(companySize, 10);
    if (formData.client_id && headcount > 0) {
      const getCompanySizeEnum = (size) => {
        const num = parseInt(size, 10);
        if (!num) return null;
        if (num <= 50) return '1-50';
        if (num <= 200) return '51-200';
        if (num <= 500) return '201-500';
        if (num <= 1000) return '501-1000';
        if (num <= 5000) return '1001-5000';
        return '5000+';
      };
      base44.entities.Client.update(formData.client_id, {
        employee_count: headcount,
        company_size: getCompanySizeEnum(companySize),
      }).catch(() => {});
    }
    saveMutation.mutate({
    ...formData,
    total_amount: calculateTotal(),
    matched_stage: matchedStageLabel || undefined,
    selections: { ...(proposal?.selections || {}), ...selections, challengePrice, priceOverrides, customCharges }
    });
  };

  const renderServiceList = (serviceList, selectionKey) => {
    if (serviceList.length === 0) {
      return <p className="text-gray-400 text-sm italic">No services found. Add services in the Service Catalog.</p>;
    }
    return serviceList.map((service) => {
      const isSelected = (selections[selectionKey] || []).includes(service.id);
      return (
        <div key={service.id} className={`flex items-center gap-4 p-3 rounded-lg border ${isSelected ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
          <Checkbox checked={isSelected} onCheckedChange={() => toggleItem(selectionKey, service.id)} />
          <div className="flex-1">
            <p className="font-medium">{service.name}</p>
            {service.duration && <p className="text-xs text-gray-400">{service.duration}</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">$</span>
            <Input
              type="number"
              className="w-24"
              value={getPrice(service.id)}
              onChange={(e) => setPrice(service.id, e.target.value)}
            />
          </div>
        </div>
      );
    });
  };

  // Challenges are priced canonically from headcount (not the $1,500 fallback).
  const renderChallengeList = () => {
    const list = getServicesByCategory('challenge');
    if (list.length === 0) {
      return <p className="text-gray-400 text-sm italic">No services found. Add services in the Service Catalog.</p>;
    }
    const hasHeadcount = challengePricing != null;
    return list.map((service) => {
      const isSelected = (selections.challengePrograms || []).includes(service.id);
      const override = priceOverrides[service.id];
      const hasOverride = override !== undefined;
      const displayPrice = hasOverride ? override : (hasHeadcount ? challengePrice : null);
      return (
        <div key={service.id} className={`flex items-center gap-4 p-3 rounded-lg border ${isSelected ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
          <Checkbox checked={isSelected} onCheckedChange={() => toggleItem('challengePrograms', service.id)} />
          <div className="flex-1">
            <p className="font-medium">{service.name}</p>
            {service.duration && <p className="text-xs text-gray-400">{service.duration}</p>}
            {!hasHeadcount && !hasOverride && (
              <p className="text-xs text-amber-600 mt-0.5">Enter company size to price this challenge</p>
            )}
          </div>
          {hasOverride || hasHeadcount ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">$</span>
              <Input
                type="number"
                className="w-24"
                value={displayPrice ?? ''}
                onChange={(e) => setPrice(service.id, e.target.value)}
              />
            </div>
          ) : (
            <span className="text-gray-400 font-medium w-28 text-right">—</span>
          )}
        </div>
      );
    });
  };

  const generatePDF = async () => {
    const getName = (id) => serviceMap[id]?.name || id;
    const getDesc = (id) => serviceMap[id]?.description || '';

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
            ${selections.workshops.map(id => `<div class="item"><div class="item-title">${getName(id)}</div><div class="item-price">$${getPrice(id).toLocaleString()}</div>${getDesc(id) ? `<div class="item-description">${getDesc(id)}</div>` : ''}</div>`).join('')}
          </div>
        ` : ''}

        ${selections.challengePrograms.length > 0 ? `
          <div class="section">
            <div class="section-title">14-Day Challenges (${selections.challengePrograms.length})</div>
            ${selections.challengePrograms.map(id => `<div class="item"><div class="item-title">${getName(id)}</div><div class="item-price">$${(challengePrice != null ? challengePrice.toLocaleString() : '—')}</div>${getDesc(id) ? `<div class="item-description">${getDesc(id)}</div>` : ''}</div>`).join('')}
          </div>
        ` : ''}

        ${selections.leadership.length > 0 ? `
          <div class="section">
            <div class="section-title">Leadership Programs (${selections.leadership.length})</div>
            ${selections.leadership.map(id => `<div class="item"><div class="item-title">${getName(id)}</div><div class="item-price">$${getPrice(id).toLocaleString()}</div>${getDesc(id) ? `<div class="item-description">${getDesc(id)}</div>` : ''}</div>`).join('')}
          </div>
        ` : ''}

        ${selections.movementClasses.length > 0 ? `
          <div class="section">
            <div class="section-title">Classes (${selections.movementClasses.length})</div>
            ${selections.movementClasses.map(id => `<div class="item"><div class="item-title">${getName(id)}</div><div class="item-price">$${getPrice(id).toLocaleString()}</div>${getDesc(id) ? `<div class="item-description">${getDesc(id)}</div>` : ''}</div>`).join('')}
          </div>
        ` : ''}

        ${(() => {
          const boxes = selections.sampleBoxQuantities || {};
          const { prices: pdfBoxPrices } = resolveBoxPrices(services);
          const boxSnapshot = selections.sampleBoxPrices;
          const boxRows = Object.entries(boxes).filter(([,q]) => (q || 0) > 0).map(([key, qty]) => {
            const label = BOX_DISPLAY_NAMES[key]; if (!label) return '';
            const price = getBoxPrice(key, boxSnapshot, pdfBoxPrices);
            return `<div class="item"><div class="item-title">${label} (${qty})</div><div class="item-price">${qty} × $${price} = $${(qty * price).toLocaleString()}</div></div>`;
          }).join('');
          const customQty = selections.customBoxQuantity || 0;
          const customItems = selections.customBoxItems || [];
          let customRow = '';
          if (customQty > 0 && customItems.length > 0) {
            const customUnitPrice = customBoxUnitPrice(customItems);
            const customTotal = customUnitPrice * customQty;
            const itemList = customItems.map(i => `${i.name} ($${i.price.toFixed(2)})`).join(', ');
            customRow = `<div class="item"><div class="item-title">Custom Wellness Box (${customQty})</div><div class="item-price">${customQty} × $${customUnitPrice.toFixed(2)} = $${customTotal.toLocaleString()}</div><div class="item-description">${itemList}</div></div>`;
          }
          if (!boxRows && !customRow) return '';
          return `<div class="section"><div class="section-title">Wellness Boxes</div>${boxRows}${customRow}</div>`;
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

    setIsGeneratingPdf(true);
    try {
      await htmlToPdfDownload(pdfContent, proposalFilename(formData));
    } catch (err) {
      console.error('Proposal PDF generation failed', err);
      toast.error("Couldn't generate the PDF — try again");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isLoading || isLoadingServices) {
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
            {matchedStageLabel && (
              <p className="text-sm text-gray-500 mt-0.5">{matchedStageLabel} engagement</p>
            )}
          </div>
          {!isNewProposal && (
            <Button variant="outline" disabled={isGeneratingPdf} onClick={generatePDF}>
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Download
            </Button>
          )}
          <Button onClick={handleSave} className="bg-[#264d44] hover:bg-[#1a3830]" disabled={saveMutation.isPending || (!isNewProposal && !isDirty)}>
            <Save className="w-4 h-4 mr-2" /> {saveMutation.isPending ? 'Saving...' : (isNewProposal ? 'Create' : (isDirty ? 'Save' : 'Saved'))}
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
                onChange={(e) => { setIsDirty(true); setFormData({...formData, client_name: e.target.value}); }}
                disabled={isNewProposal && !formData.client_id}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Company</label>
              <Input 
                value={formData.company} 
                onChange={(e) => { setIsDirty(true); setFormData({...formData, company: e.target.value}); }}
                disabled={isNewProposal && !formData.client_id}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
              <Select value={formData.status} onValueChange={(value) => { setIsDirty(true); setFormData({...formData, status: value}); }}>
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
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">Company Size (Number of Employees)</label>
            <Input
              type="number"
              min="1"
              placeholder="Enter number of employees..."
              value={selections.assessmentData?.companySize ?? ''}
              onChange={(e) => { setIsDirty(true); setSelections(prev => ({ ...prev, assessmentData: { ...(prev.assessmentData || {}), companySize: e.target.value } })); }}
              disabled={isNewProposal && !formData.client_id}
            />
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
          <Textarea 
            value={formData.narrative_summary} 
            onChange={(e) => { setIsDirty(true); setFormData({...formData, narrative_summary: e.target.value}); }}
            placeholder="Click 'Auto-Generate' to create a narrative based on selected services, or write your own..."
            rows={6}
            className="resize-y"
          />
        </div>

        {/* Workshops */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#264d44' }}>Workshops</h2>
          <div className="space-y-3">
            {renderServiceList(getServicesByCategory('workshop'), 'workshops')}
          </div>
        </div>

        {/* Challenges */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#264d44' }}>14-Day Challenges</h2>
          {challengePricing ? (
            <p className="text-sm text-gray-600 mb-3">
              {parseInt(selections.assessmentData?.companySize, 10) || 0} employees × 20% expected participation = {challengePricing.targetSlots} slots @ ${challengePricing.pricePerPerson}/person = ${challengePricing.totalCost.toLocaleString()}
              {challengePricing.minimumApplied && <span className="block text-xs text-amber-600 mt-0.5">40-slot platform minimum applied</span>}
            </p>
          ) : (
            <p className="text-sm text-gray-400 mb-3">Enter company size (above) to estimate challenge pricing.</p>
          )}
          <div className="space-y-3">
            {renderChallengeList()}
          </div>
        </div>

        {/* Leadership */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#264d44' }}>Leadership Programs</h2>
          <div className="space-y-3">
            {renderServiceList(getServicesByCategory('leadership'), 'leadership')}
          </div>
        </div>

        {/* Classes */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#264d44' }}>Classes</h2>
          <div className="space-y-3">
            {renderServiceList(getServicesByCategory('class'), 'movementClasses')}
          </div>
        </div>

        {/* Wellness Boxes */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4" style={{ color: '#264d44' }}>Wellness Boxes</h2>
          <div className="space-y-3">
            {[
              { key: 'reduceStress', name: 'Reduce Stress Box', price: 65 },
              { key: 'relaxationSleep', name: 'Relaxation & Sleep Box', price: 65 },
              { key: 'largeEmotional', name: 'Large Emotional Wellness Box', price: 100 },
              { key: 'largeStressReduction', name: 'Large Stress Reduction Box', price: 120 },
              { key: 'stressReductionDigital', name: 'Stress Reduction Digital Box', price: 50 },
              { key: 'beyondBurnoutDigital', name: 'Beyond Burnout Digital Box', price: 100 },
              { key: 'emotionalWellness', name: 'Emotional Wellness Box', price: 100 },
              { key: 'wintertimeHealthy', name: 'Wintertime Stay Healthy Box', price: 100 },
              { key: 'newYearFreshStart', name: 'New Year Fresh Start Box', price: 100 }
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