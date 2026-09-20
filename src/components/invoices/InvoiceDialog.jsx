import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, Loader2, Building2, FileText, DollarSign, ListOrdered } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { BOX_DISPLAY_NAMES, WELLNESS_BOX_PRICES, applyBoxFloor } from '@/lib/wellnessBoxes';
import { priceForCatalogItem, resolveHeadcount } from '@/lib/rateCard';
import { INVOICE_STATUS_CONFIG } from '@/lib/statusConfig';
import { RecordDetailContent, RecordDetailFrame, RailSection, FrameSection, FieldRow } from '@/components/shared/RecordDetailFrame';

export default function InvoiceDialog({ open, onOpenChange, invoice, mode, clients, preselectedProposalId }) {
  const [formData, setFormData] = useState({
    client_id: '',
    client_name: '',
    client_email: '',
    company: '',
    proposal_id: '',
    invoice_number: '',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    line_items: [{ name: '', description: '', quantity: 1, rate: 0, amount: 0 }],
    tax_rate: 0,
    memo: '',
    notes: ''
  });

  const queryClient = useQueryClient();

  const { data: proposals = [] } = useQuery({
    queryKey: ['proposals'],
    queryFn: () => base44.entities.Proposal.list('-created_date'),
    enabled: mode === 'create'
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list()
  });

  useEffect(() => {
    if (invoice && mode !== 'create') {
      setFormData({
        ...invoice,
        issue_date: invoice.issue_date || new Date().toISOString().slice(0, 10),
        due_date: invoice.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      });
    }
  }, [invoice, mode]);

  // Auto-select proposal when navigated from Proposals page
  useEffect(() => {
    if (mode === 'create' && preselectedProposalId && proposals.length > 0) {
      const proposal = proposals.find(p => p.id === preselectedProposalId);
      if (proposal) {
        // First set the client
        const client = clients.find(c => c.id === proposal.client_id);
        if (client) {
          setFormData(prev => ({
            ...prev,
            client_id: client.id,
            client_name: client.name,
            client_email: client.email,
            company: client.company || '',
            proposal_id: ''
          }));
        }
        // Then trigger proposal import
        handleProposalChange(preselectedProposalId);
      }
    }
  }, [preselectedProposalId, proposals, mode]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Invoice.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onOpenChange(false);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Invoice.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onOpenChange(false);
    }
  });

  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setFormData({
        ...formData,
        client_id: clientId,
        client_name: client.name,
        client_email: client.email,
        company: client.company || '',
        proposal_id: '' // Reset proposal when changing client
      });
    }
  };

  const handleProposalChange = async (proposalId) => {
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) return;

    const lineItems = [];
    const selections = proposal.selections || {};
    const invoicedItems = proposal.invoiced_items || [];
    const priceOverrides = selections.priceOverrides || {};
    const headcount = resolveHeadcount(selections.assessmentData?.companySize);

    // An invoice must bill what was QUOTED, so a snapshot wins over a fresh
    // calculation. Service.price is deliberately NOT used for workshops,
    // challenges or leadership: it is a single stored number and those prices
    // depend on headcount. For challenges it is a PER-PARTICIPANT rate, which
    // is how a $1,500+ program could invoice as $30 — the same trap
    // base44/shared/quickbooksInvoiceBuilder.ts explicitly guards against.
    const resolvePrice = (category, serviceId, snapshotList) => {
      if (priceOverrides[serviceId] !== undefined) return priceOverrides[serviceId];
      const snap = (snapshotList || []).find(x => x.id === serviceId);
      if (snap && snap.price > 0) return snap.price;
      if (category === 'challenges' && selections.challengePrice > 0) return selections.challengePrice;
      const key = serviceMap[serviceId]?.qb_item_name || serviceId;
      return priceForCatalogItem(category, key, headcount) ?? 0;
    };
    
    // Build service lookup map
    const serviceMap = {};
    services.forEach(s => { serviceMap[s.id] = s; });
    
    // Add workshops
    if (Array.isArray(selections.workshops)) {
      selections.workshops.forEach(serviceId => {
        const service = serviceMap[serviceId];
        if (service) {
          const itemId = `workshop_${serviceId}`;
          const price = resolvePrice('workshops', serviceId, selections.workshopsData);
          lineItems.push({
            name: service.name,
            description: service.description || '',
            quantity: 1,
            rate: price,
            amount: price,
            service_id: serviceId,
            proposal_item_id: itemId,
            already_invoiced: invoicedItems.includes(itemId)
          });
        }
      });
    }

    // Add challenge programs
    if (Array.isArray(selections.challengePrograms)) {
      selections.challengePrograms.forEach(serviceId => {
        const service = serviceMap[serviceId];
        if (service) {
          const itemId = `challenge_${serviceId}`;
          const price = resolvePrice('challenges', serviceId, selections.challengeProgramsData);
          lineItems.push({
            name: service.name,
            description: service.description || '',
            quantity: 1,
            rate: price,
            amount: price,
            service_id: serviceId,
            proposal_item_id: itemId,
            already_invoiced: invoicedItems.includes(itemId)
          });
        }
      });
    }

    // Add leadership programs
    if (Array.isArray(selections.leadership)) {
      selections.leadership.forEach(serviceId => {
        const service = serviceMap[serviceId];
        if (service) {
          const itemId = `leadership_${serviceId}`;
          const price = resolvePrice('leadership', serviceId, selections.leadershipData);
          lineItems.push({
            name: service.name,
            description: service.description || '',
            quantity: 1,
            rate: price,
            amount: price,
            service_id: serviceId,
            proposal_item_id: itemId,
            already_invoiced: invoicedItems.includes(itemId)
          });
        }
      });
    }

    // Add movement classes
    if (Array.isArray(selections.movementClasses)) {
      selections.movementClasses.forEach(serviceId => {
        const service = serviceMap[serviceId];
        if (service) {
          const itemId = `class_${serviceId}`;
          const price = resolvePrice('movementClasses', serviceId, selections.movementClassesData);
          lineItems.push({
            name: service.name,
            description: service.description || '',
            quantity: 1,
            rate: price,
            amount: price,
            service_id: serviceId,
            proposal_item_id: itemId,
            already_invoiced: invoicedItems.includes(itemId)
          });
        }
      });
    }

    // Add wellness boxes — uses shared display-name map (all 9 keys) and
    // resolves Service by qb_box_key only. The old name-based fallback
    // matched display names against Service names and only ever matched
    // largeEmotional, so it was dead code.
    if (selections.sampleBoxQuantities) {
      Object.entries(selections.sampleBoxQuantities).forEach(([key, quantity]) => {
        if (quantity > 0) {
          const itemId = `box_${key}`;
          const price = applyBoxFloor(key, (selections.sampleBoxPrices?.[key] ?? WELLNESS_BOX_PRICES[key]) || 0);
          lineItems.push({
            name: BOX_DISPLAY_NAMES[key] || key,
            description: '',
            quantity: quantity,
            rate: price,
            amount: price * quantity,
            service_id: services.find(s => s.category === 'wellness_box' && s.qb_box_key === key)?.id || null,
            proposal_item_id: itemId,
            already_invoiced: invoicedItems.includes(itemId)
          });
        }
      });
    }

    // Add custom charges
    if (Array.isArray(selections.customCharges)) {
      selections.customCharges.forEach((charge, idx) => {
        const itemId = `custom_${idx}`;
        lineItems.push({
          name: charge.label || 'Custom Charge',
          description: '',
          quantity: 1,
          rate: charge.amount,
          amount: charge.amount,
          proposal_item_id: itemId,
          already_invoiced: invoicedItems.includes(itemId)
        });
      });
    }

    setFormData({
      ...formData,
      proposal_id: proposalId,
      line_items: lineItems.length > 0 ? lineItems : [{ name: '', description: '', quantity: 1, rate: 0, amount: 0 }],
      memo: proposal.narrative_summary || ''
    });
  };

  const updateLineItem = (index, field, value) => {
    const items = [...formData.line_items];
    items[index][field] = value;
    
    if (field === 'quantity' || field === 'rate') {
      items[index].amount = items[index].quantity * items[index].rate;
    }
    
    setFormData({ ...formData, line_items: items });
  };

  const addLineItem = () => {
    setFormData({
      ...formData,
      line_items: [...formData.line_items, { name: '', description: '', quantity: 1, rate: 0, amount: 0 }]
    });
  };

  const removeLineItem = (index) => {
    const items = formData.line_items.filter((_, i) => i !== index);
    setFormData({ ...formData, line_items: items });
  };

  const calculateTotals = () => {
    const subtotal = formData.line_items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const tax_amount = subtotal * (formData.tax_rate / 100);
    const total = subtotal + tax_amount;
    return { subtotal, tax_amount, total };
  };

  const handleSave = async () => {
    const { subtotal, tax_amount, total } = calculateTotals();
    const linkedClient = formData.client_id ? clients.find(c => c.id === formData.client_id) : null;
    const invoiceData = {
      ...formData,
      subtotal,
      tax_amount,
      total_amount: total,
      status: 'draft',
      is_demo: linkedClient?.is_demo === true,
    };

    if (mode === 'create') {
      createMutation.mutate(invoiceData);
      
      // Update proposal to track invoiced items
      if (formData.proposal_id) {
        const invoicedItemIds = formData.line_items
          .filter(item => item.proposal_item_id)
          .map(item => item.proposal_item_id);
        
        if (invoicedItemIds.length > 0) {
          const proposal = proposals.find(p => p.id === formData.proposal_id);
          if (proposal) {
            const existingInvoiced = proposal.invoiced_items || [];
            const updatedInvoiced = [...new Set([...existingInvoiced, ...invoicedItemIds])];
            await base44.entities.Proposal.update(formData.proposal_id, {
              invoiced_items: updatedInvoiced
            });
          }
        }
      }
    } else {
      updateMutation.mutate({ id: invoice.id, data: invoiceData });
    }
  };

  const { subtotal, tax_amount, total } = calculateTotals();
  const isReadOnly = mode === 'view';
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const lineItems = formData.line_items || [];
  const statusCfg = INVOICE_STATUS_CONFIG[formData.status] || null;
  const money = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(`${String(d).slice(0, 10)}T00:00:00`);
    return isNaN(dt.getTime()) ? String(d) : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  const acceptedForClient = proposals.filter(p => p.client_id === formData.client_id && p.status === 'accepted');

  // ── Responsive layout (see RecordDetailFrame) ──
  // Header: title, status, running total. Rail: client, invoice details,
  // totals — beside the lines on wide windows, above them on narrow ones.
  // Main: line items (a read-only table in view mode), memo, notes.
  // Footer (edit/create only): Save stays pinned however long the list is.
  const title = mode === 'create'
    ? 'Create Invoice'
    : `${mode === 'edit' ? 'Edit invoice' : 'Invoice'}${formData.invoice_number ? ` ${formData.invoice_number}` : ''}`;
  const partyLine = [
    formData.company,
    formData.client_name && formData.client_name !== formData.company ? formData.client_name : null,
  ].filter(Boolean).join(' · ');

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <DialogTitle className="text-xl font-bold text-[#013f7c]">{title}</DialogTitle>
          {statusCfg && mode !== 'create' && <Badge className={statusCfg.color}>{statusCfg.label}</Badge>}
        </div>
        <p className="text-sm text-gray-500 mt-0.5 truncate">
          {mode === 'create'
            ? 'Choose a client, optionally import an accepted proposal, then adjust the lines.'
            : (partyLine || 'No client on this invoice')}
        </p>
      </div>
      <div className="sm:text-right">
        <p className="text-[11px] uppercase tracking-wide text-gray-500">Total</p>
        <p className="text-2xl font-bold leading-tight tabular-nums" style={{ color: '#770142' }}>{money(total)}</p>
      </div>
    </div>
  );

  const dateField = (label, key) => (
    <div className="min-w-0">
      <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">{label}</label>
      {isReadOnly ? (
        <p className="text-sm text-gray-800">{fmtDate(formData[key])}</p>
      ) : (
        <Input
          type="date"
          value={formData[key] || ''}
          onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
          className="bg-white h-9"
        />
      )}
    </div>
  );

  const rail = (
    <>
      <RailSection title="Client" icon={Building2}>
        {mode === 'create' ? (
          <div className="space-y-2">
            <Select value={formData.client_id} onValueChange={handleClientChange}>
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select client..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map(client => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.company || client.name}
                    {client.company && client.name && client.name !== client.company ? ` — ${client.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={formData.proposal_id}
              onValueChange={handleProposalChange}
              disabled={!formData.client_id}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Import from proposal (optional)..." />
              </SelectTrigger>
              <SelectContent>
                {acceptedForClient.map(proposal => (
                  <SelectItem key={proposal.id} value={proposal.id}>
                    Proposal - ${proposal.total_amount?.toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formData.client_id && acceptedForClient.length === 0 && (
              <p className="text-[11px] text-gray-400">No accepted proposals for this client — add the lines by hand.</p>
            )}
          </div>
        ) : (
          <dl className="space-y-1.5">
            <FieldRow label="Company">{formData.company || '—'}</FieldRow>
            <FieldRow label="Contact">{formData.client_name || '—'}</FieldRow>
            {formData.client_email && (
              <FieldRow label="Email">
                <a href={`mailto:${formData.client_email}`} className="text-[#013f7c] hover:underline break-all">{formData.client_email}</a>
              </FieldRow>
            )}
          </dl>
        )}
      </RailSection>

      <RailSection title="Details" icon={FileText}>
        <div className="space-y-2.5">
          <div>
            <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">Invoice number</label>
            {mode === 'create' ? (
              <Input
                placeholder="Invoice Number"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                className="bg-white h-9"
              />
            ) : (
              <p className="text-sm text-gray-800">{formData.invoice_number || '—'}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {dateField('Issue date', 'issue_date')}
            {dateField('Due date', 'due_date')}
          </div>
          {isReadOnly && formData.paid_date && (
            <dl><FieldRow label="Paid">{fmtDate(formData.paid_date)}</FieldRow></dl>
          )}
          {isReadOnly && formData.quickbooks_id && (
            <dl>
              <FieldRow label="QuickBooks">
                #{formData.quickbooks_id}{formData.quickbooks_sync_date ? ` · synced ${fmtDate(formData.quickbooks_sync_date)}` : ''}
              </FieldRow>
            </dl>
          )}
        </div>
      </RailSection>

      <RailSection title="Totals" icon={DollarSign}>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-semibold tabular-nums">{money(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center gap-2">
            <span className="text-gray-600 flex items-center gap-1.5">
              Tax
              {isReadOnly ? (
                <span className="text-gray-500">({formData.tax_rate || 0}%)</span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Input
                    type="number"
                    value={formData.tax_rate}
                    onChange={(e) => setFormData({ ...formData, tax_rate: Number(e.target.value) })}
                    className="w-16 h-7 px-2 text-xs bg-white"
                    aria-label="Tax rate"
                  />
                  <span className="text-gray-500 text-xs">%</span>
                </span>
              )}
            </span>
            <span className="font-semibold tabular-nums">{money(tax_amount)}</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-2 mt-1 border-t">
            <span>Total</span>
            <span className="tabular-nums" style={{ color: '#770142' }}>{money(total)}</span>
          </div>
        </div>
      </RailSection>
    </>
  );

  const textBlock = (value) => (
    <p className="text-sm text-gray-700 whitespace-pre-line rounded-lg bg-gray-50 border border-gray-100 p-3 min-h-[3rem]">
      {value || <span className="text-gray-400">—</span>}
    </p>
  );

  const footer = !isReadOnly ? (
    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
      <p className="text-xs text-gray-500 hidden sm:block">
        {lineItems.length} line{lineItems.length === 1 ? '' : 's'} · total {money(total)}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">Cancel</Button>
        <Button onClick={handleSave} disabled={isSaving} className="flex-1 sm:flex-none bg-[#264d44] hover:bg-[#1a3830]">
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save Invoice
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <RecordDetailContent maxWidth="1120px" fill={false}>
        <RecordDetailFrame header={header} rail={rail} footer={footer}>
          <div className="space-y-6">
            <FrameSection
              title={`Line items (${lineItems.length})`}
              icon={ListOrdered}
              action={!isReadOnly && (
                <Button size="sm" variant="outline" onClick={addLineItem} className="h-8">
                  <Plus className="w-4 h-4 mr-1" /> Add item
                </Button>
              )}
            >
              {isReadOnly ? (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500">
                        <th className="py-2 px-3 font-semibold">Item</th>
                        <th className="py-2 px-3 font-semibold text-right">Qty</th>
                        <th className="py-2 px-3 font-semibold text-right">Rate</th>
                        <th className="py-2 px-3 font-semibold text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {lineItems.map((item, idx) => (
                        <tr key={idx} className="align-top">
                          <td className="py-2.5 px-3 min-w-[12rem]">
                            <p className="font-medium text-gray-800">{item.name || '—'}</p>
                            {item.description && (
                              <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-line">{item.description}</p>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{item.quantity ?? 1}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{money(item.rate)}</td>
                          <td className="py-2.5 px-3 text-right font-semibold tabular-nums">{money(item.amount)}</td>
                        </tr>
                      ))}
                      {lineItems.length === 0 && (
                        <tr><td colSpan={4} className="py-6 text-center text-gray-400">No line items.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Column labels — wide windows only; narrow ones label each cell */}
                  <div className="hidden md:grid grid-cols-12 gap-x-3 px-3 text-[10px] uppercase tracking-wide text-gray-400">
                    <span className="col-span-6">Item</span>
                    <span className="col-span-2">Qty</span>
                    <span className="col-span-2">Rate</span>
                    <span className="col-span-2 text-right">Amount</span>
                  </div>
                  {lineItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`relative rounded-lg border p-3 ${item.already_invoiced ? 'border-amber-300 bg-amber-50/40' : 'border-gray-200 bg-white'}`}
                    >
                      {item.already_invoiced && (
                        <span className="absolute -top-2 right-3 bg-amber-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                          Already invoiced
                        </span>
                      )}
                      <div className="grid grid-cols-12 gap-x-3 gap-y-2 items-start">
                        <div className="col-span-12 md:col-span-6 space-y-2">
                          <Input
                            placeholder="Item Name"
                            value={item.name || ''}
                            onChange={(e) => updateLineItem(idx, 'name', e.target.value)}
                            className="font-semibold"
                          />
                          <Textarea
                            placeholder="Description"
                            value={item.description || ''}
                            onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                            rows={2}
                            className="text-sm"
                          />
                        </div>
                        <div className="col-span-4 md:col-span-2">
                          <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5 md:hidden">Qty</label>
                          <Input
                            type="number"
                            placeholder="Qty"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(idx, 'quantity', Number(e.target.value))}
                          />
                        </div>
                        <div className="col-span-4 md:col-span-2">
                          <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5 md:hidden">Rate</label>
                          <Input
                            type="number"
                            placeholder="Rate"
                            value={item.rate}
                            onChange={(e) => updateLineItem(idx, 'rate', Number(e.target.value))}
                          />
                        </div>
                        <div className="col-span-4 md:col-span-2 flex flex-col items-end">
                          <label className="block text-[10px] uppercase tracking-wide text-gray-400 mb-0.5 md:hidden">Amount</label>
                          <p className="font-semibold text-base tabular-nums md:pt-1.5">{money(item.amount)}</p>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 mt-1 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => removeLineItem(idx)}
                            title="Remove this line"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {lineItems.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6 border border-dashed rounded-lg">No line items — add one above.</p>
                  )}
                </div>
              )}
            </FrameSection>

            <div className="grid gap-4 md:grid-cols-2">
              <FrameSection title="Customer memo">
                {isReadOnly ? textBlock(formData.memo) : (
                  <Textarea
                    placeholder="Visible to customer..."
                    value={formData.memo || ''}
                    onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
                    rows={3}
                  />
                )}
              </FrameSection>
              <FrameSection title="Internal notes">
                {isReadOnly ? textBlock(formData.notes) : (
                  <Textarea
                    placeholder="Private notes..."
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                  />
                )}
              </FrameSection>
            </div>
          </div>
        </RecordDetailFrame>
      </RecordDetailContent>
    </Dialog>
  );
}
