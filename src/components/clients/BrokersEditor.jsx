import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus } from 'lucide-react';

/**
 * BrokersEditor — reusable component for adding/editing multiple brokers.
 * Props:
 *   brokers: array of { name, email, company, phone, notes }
 *   onChange: (updatedBrokers) => void
 */
export default function BrokersEditor({ brokers = [], onChange }) {
  const addBroker = () => {
    onChange([...brokers, { name: '', email: '', company: '', phone: '', notes: '' }]);
  };

  const updateBroker = (index, field, value) => {
    const updated = brokers.map((b, i) => i === index ? { ...b, [field]: value } : b);
    onChange(updated);
  };

  const removeBroker = (index) => {
    onChange(brokers.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      {brokers.map((broker, index) => (
        <div key={index} className="border rounded-lg p-3 bg-blue-50 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
              Broker {brokers.length > 1 ? index + 1 : ''}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-red-500 hover:text-red-700"
              onClick={() => removeBroker(index)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              placeholder="Broker Name"
              value={broker.name}
              onChange={(e) => updateBroker(index, 'name', e.target.value)}
            />
            <Input
              type="email"
              placeholder="Broker Email"
              value={broker.email}
              onChange={(e) => updateBroker(index, 'email', e.target.value)}
            />
            <Input
              placeholder="Brokerage / Company"
              value={broker.company || ''}
              onChange={(e) => updateBroker(index, 'company', e.target.value)}
            />
            <Input
              placeholder="Phone (optional)"
              value={broker.phone || ''}
              onChange={(e) => updateBroker(index, 'phone', e.target.value)}
            />
          </div>
          <Input
            placeholder="Notes (optional)"
            value={broker.notes || ''}
            onChange={(e) => updateBroker(index, 'notes', e.target.value)}
          />
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addBroker}
        className="w-full border-dashed border-blue-300 text-blue-600 hover:bg-blue-50"
      >
        <Plus className="w-4 h-4 mr-1" /> Add Broker
      </Button>
    </div>
  );
}