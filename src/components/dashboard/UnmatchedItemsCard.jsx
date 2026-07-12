import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';

/**
 * Expandable card showing invoice line items that couldn't be matched
 * to a Service entity, so mislabeled descriptions can be found and fixed.
 */
export default function UnmatchedItemsCard({ items }) {
  const [expanded, setExpanded] = useState(false);

  const groups = useMemo(() => {
    const map = {};
    items.forEach(item => {
      const key = item.description || '(no description)';
      if (!map[key]) map[key] = { description: key, totalAmount: 0, totalQty: 0, invoices: [] };
      map[key].totalAmount += item.amount || 0;
      map[key].totalQty += item.quantity || 1;
      if (item.invoiceNumber && !map[key].invoices.includes(item.invoiceNumber)) {
        map[key].invoices.push(item.invoiceNumber);
      }
    });
    return Object.values(map).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [items]);

  if (items.length === 0) return null;

  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <CardTitle className="flex items-center justify-between text-lg text-amber-800">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
            <AlertCircle className="w-5 h-5" />
            Other / Unmatched
          </div>
          <Badge className="bg-amber-100 text-amber-700 border border-amber-300">
            {items.length} line item{items.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent>
          <p className="text-sm text-gray-500 mb-3">
            These invoice line items couldn't be matched to a Service. Fix the line item description
            or QuickBooks item ID to match a service name.
          </p>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {groups.map((g, i) => (
              <div key={i} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-medium text-gray-800 text-sm truncate flex-1">{g.description}</p>
                  <span className="text-sm font-bold text-gray-700 shrink-0">
                    ${g.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{g.totalQty} sold</span>
                  <span>·</span>
                  <span>Invoices: {g.invoices.join(', ') || 'N/A'}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}