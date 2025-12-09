import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';

export default function InvoiceDialog({ open, onOpenChange, invoice, mode, clients }) {
  const [formData, setFormData] = useState({
    client_id: '',
    client_name: '',
    client_email: '',
    company: '',
    proposal_id: '',
    invoice_number: '',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    line_items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
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

  useEffect(() => {
    if (invoice && mode !== 'create') {
      setFormData({
        ...invoice,
        issue_date: invoice.issue_date || new Date().toISOString().slice(0, 10),
        due_date: invoice.due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      });
    }
  }, [invoice, mode]);

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
    
    // Fetch services to get pricing info
    const services = await base44.entities.Service.list();
    
    // Add workshops (stored as array)
    if (Array.isArray(selections.workshops)) {
      selections.workshops.forEach(workshopKey => {
        const service = services.find(s => s.category === 'workshop' && s.name.toLowerCase().includes(workshopKey.toLowerCase()));
        const itemId = `workshop_${workshopKey}`;
        lineItems.push({
          description: service?.name || workshopKey,
          quantity: 1,
          rate: service?.price || 1500,
          amount: service?.price || 1500,
          proposal_item_id: itemId,
          already_invoiced: invoicedItems.includes(itemId)
        });
      });
    }

    // Add challenge programs (stored as array)
    if (Array.isArray(selections.challengePrograms)) {
      selections.challengePrograms.forEach(challengeKey => {
        const service = services.find(s => s.category === 'challenge' && s.name.toLowerCase().includes(challengeKey.toLowerCase()));
        const itemId = `challenge_${challengeKey}`;
        lineItems.push({
          description: service?.name || challengeKey,
          quantity: 1,
          rate: service?.price || 2000,
          amount: service?.price || 2000,
          proposal_item_id: itemId,
          already_invoiced: invoicedItems.includes(itemId)
        });
      });
    }

    // Add leadership programs (stored as array)
    if (Array.isArray(selections.leadership)) {
      selections.leadership.forEach(leadershipKey => {
        const service = services.find(s => s.category === 'leadership' && s.name.toLowerCase().includes(leadershipKey.toLowerCase()));
        const itemId = `leadership_${leadershipKey}`;
        lineItems.push({
          description: service?.name || leadershipKey,
          quantity: 1,
          rate: service?.price || 3000,
          amount: service?.price || 3000,
          proposal_item_id: itemId,
          already_invoiced: invoicedItems.includes(itemId)
        });
      });
    }

    // Add movement classes (stored as array)
    if (Array.isArray(selections.movementClasses)) {
      selections.movementClasses.forEach(classKey => {
        const service = services.find(s => s.category === 'class' && s.name.toLowerCase().includes(classKey.toLowerCase()));
        const itemId = `class_${classKey}`;
        lineItems.push({
          description: service?.name || classKey,
          quantity: 1,
          rate: service?.price || 1000,
          amount: service?.price || 1000,
          proposal_item_id: itemId,
          already_invoiced: invoicedItems.includes(itemId)
        });
      });
    }

    // Add wellness boxes
    if (selections.sampleBoxQuantities) {
      Object.entries(selections.sampleBoxQuantities).forEach(([key, quantity]) => {
        if (quantity > 0) {
          const service = services.find(s => s.category === 'wellness_box' && s.name.toLowerCase().includes(key.toLowerCase()));
          const itemId = `box_${key}`;
          lineItems.push({
            description: service?.name || key,
            quantity: quantity,
            rate: service?.price || 100,
            amount: (service?.price || 100) * quantity,
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
          description: charge.description,
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
      line_items: lineItems.length > 0 ? lineItems : [{ description: '', quantity: 1, rate: 0, amount: 0 }],
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
      line_items: [...formData.line_items, { description: '', quantity: 1, rate: 0, amount: 0 }]
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
    const invoiceData = {
      ...formData,
      subtotal,
      tax_amount,
      total_amount: total,
      status: 'draft'
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Create Invoice' : mode === 'edit' ? 'Edit Invoice' : 'View Invoice'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Client Selection */}
          <div className="grid grid-cols-2 gap-4">
            {mode === 'create' ? (
              <>
                <Select value={formData.client_id} onValueChange={handleClientChange} disabled={isReadOnly}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name} {client.company ? `- ${client.company}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select 
                  value={formData.proposal_id} 
                  onValueChange={handleProposalChange} 
                  disabled={isReadOnly || !formData.client_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Import from proposal (optional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    {proposals
                      .filter(p => p.client_id === formData.client_id && p.status === 'accepted')
                      .map(proposal => (
                        <SelectItem key={proposal.id} value={proposal.id}>
                          Proposal - ${proposal.total_amount?.toLocaleString()}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </>
            ) : (
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Client</p>
                <p className="font-semibold">{formData.client_name}</p>
                {formData.company && <p className="text-sm text-gray-600">{formData.company}</p>}
              </div>
            )}
          </div>

          {mode === 'create' && (
            <div>
              <Input
                placeholder="Invoice Number"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                disabled={isReadOnly}
              />
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-600">Issue Date</label>
              <Input
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                disabled={isReadOnly}
              />
            </div>
            <div>
              <label className="text-sm text-gray-600">Due Date</label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                disabled={isReadOnly}
              />
            </div>
          </div>

          {/* Line Items */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">Line Items</label>
              {!isReadOnly && (
                <Button size="sm" variant="outline" onClick={addLineItem}>
                  <Plus className="w-4 h-4 mr-1" /> Add Item
                </Button>
              )}
            </div>
            
            <div className="space-y-2">
              {formData.line_items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-gray-50 p-2 rounded relative">
                  {item.already_invoiced && (
                    <div className="absolute -top-1 -right-1 z-10">
                      <span className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full">
                        Already Invoiced
                      </span>
                    </div>
                  )}
                  <Input
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                    className="col-span-5"
                    disabled={isReadOnly}
                  />
                  <Input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(idx, 'quantity', Number(e.target.value))}
                    className="col-span-2"
                    disabled={isReadOnly}
                  />
                  <Input
                    type="number"
                    placeholder="Rate"
                    value={item.rate}
                    onChange={(e) => updateLineItem(idx, 'rate', Number(e.target.value))}
                    className="col-span-2"
                    disabled={isReadOnly}
                  />
                  <div className="col-span-2 text-right font-semibold">
                    ${item.amount.toLocaleString()}
                  </div>
                  {!isReadOnly && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="col-span-1 text-red-500"
                      onClick={() => removeLineItem(idx)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-semibold">${subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Tax Rate:</span>
                {!isReadOnly && (
                  <Input
                    type="number"
                    value={formData.tax_rate}
                    onChange={(e) => setFormData({ ...formData, tax_rate: Number(e.target.value) })}
                    className="w-20"
                    disabled={isReadOnly}
                  />
                )}
                {isReadOnly && <span>{formData.tax_rate}%</span>}
                <span className="text-gray-600">%</span>
              </div>
              <span className="font-semibold">${tax_amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Total:</span>
              <span style={{ color: '#770142' }}>${total.toLocaleString()}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm text-gray-600">Customer Memo</label>
            <Textarea
              placeholder="Visible to customer..."
              value={formData.memo}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              rows={2}
              disabled={isReadOnly}
            />
          </div>

          <div>
            <label className="text-sm text-gray-600">Internal Notes</label>
            <Textarea
              placeholder="Private notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              disabled={isReadOnly}
            />
          </div>

          {/* Actions */}
          {!isReadOnly && (
            <Button onClick={handleSave} className="w-full bg-[#264d44] hover:bg-[#1a3830]">
              <Save className="w-4 h-4 mr-2" /> Save Invoice
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}