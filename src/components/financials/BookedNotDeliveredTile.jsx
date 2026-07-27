import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/dashboardStyle';
import { useServiceDeliveryAnalytics } from '@/components/dashboard/useServiceDeliveryAnalytics';

export default function BookedNotDeliveredTile() {
  const { gapRevenue, gapRows, isLoading } = useServiceDeliveryAnalytics();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-gray-400">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={gapRows.length > 0 ? 'border-amber-200 bg-amber-50/50' : ''}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">Booked, Not Delivered</p>
            <p className="text-3xl font-bold text-amber-600">{formatCurrency(gapRevenue)}</p>
            <p className="text-sm text-gray-500 mt-1">
              {gapRows.length} service{gapRows.length !== 1 ? 's' : ''} with 0 deliveries
            </p>
          </div>
          <div className="p-3 rounded-full bg-amber-100">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}