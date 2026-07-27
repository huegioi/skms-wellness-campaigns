import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, CheckCircle2, CalendarClock, AlertTriangle, Package } from 'lucide-react';
import { format } from 'date-fns';
import { categoryCountLabel, CATEGORY_LABELS } from '@/lib/serviceMatching';
import { CHART_PALETTE, formatCurrency } from '@/lib/dashboardStyle';
import DashboardSkeleton from './DashboardSkeleton';
import DashboardEmptyState from './DashboardEmptyState';
import UnmatchedItemsCard from './UnmatchedItemsCard';
import ServiceDemandChart from './ServiceDemandChart';
import { useServiceDeliveryAnalytics } from './useServiceDeliveryAnalytics';

export default function ServicesAnalytics() {
  const {
    serviceRows,
    gapRows,
    gapRevenue,
    totalRevenue,
    totalDelivered,
    totalBooked,
    unmatchedItems,
    deliveredBreakdownStr,
    hasData,
    isLoading,
    events,
    serviceMap,
  } = useServiceDeliveryAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <DashboardSkeleton title rows={4} />
        <DashboardSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Service Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-green/10">
                <CheckCircle2 className="w-5 h-5 text-brand-green" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Delivered</p>
                <p className="text-2xl font-bold">{totalDelivered}</p>
                {deliveredBreakdownStr && (
                  <p className="text-xs text-gray-400 mt-0.5">{deliveredBreakdownStr}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <CalendarClock className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Booked Ahead</p>
                <p className="text-2xl font-bold">{totalBooked}</p>
                <p className="text-xs text-gray-400 mt-0.5">upcoming sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={gapRows.length > 0 ? 'border-amber-200 bg-amber-50/50' : ''}>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Invoiced, Not Delivered</p>
                <p className="text-2xl font-bold text-amber-700">{formatCurrency(gapRevenue)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{gapRows.length} service{gapRows.length !== 1 ? 's' : ''} with 0 deliveries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-service table: revenue + delivery side by side */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-brand-green">
            Revenue vs Delivery by Service
          </CardTitle>
          <p className="text-sm text-gray-500">
            Invoiced revenue and delivered sessions side by side — gaps flag services sold but never scheduled.
          </p>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {serviceRows.length === 0 ? (
            <DashboardEmptyState icon={Package} message="No service data yet" />
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Column headers */}
                <div className="grid grid-cols-12 gap-2 px-3 pb-2 text-xs font-medium text-gray-400 uppercase tracking-wide border-b">
                  <div className="col-span-5">Service</div>
                  <div className="col-span-3 text-right">Revenue</div>
                  <div className="col-span-2 text-right">Delivered</div>
                  <div className="col-span-2 text-right">Booked</div>
                </div>
                {/* Rows */}
                <div className="space-y-1 mt-1">
                  {serviceRows.map(row => (
                    <div key={row.serviceId} className="grid grid-cols-12 gap-2 items-center px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="col-span-5 min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{row.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-400">{CATEGORY_LABELS[row.category] || 'Other'}</span>
                          {row.hasGap && (
                            <Badge className="text-[10px] bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0">
                              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                              No deliveries
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="col-span-3 text-right">
                        <p className="font-bold text-green-600 text-sm">
                          {formatCurrency(row.revenue)}
                        </p>
                        <p className="text-xs text-gray-400">
                          {row.invoiceCount > 0 ? categoryCountLabel(row.category, row.invoiceCount) : '—'}
                        </p>
                      </div>
                      <div className="col-span-2 text-right">
                        <p className="font-bold text-brand-green text-sm">{row.deliveredCount || '—'}</p>
                        <p className="text-xs text-gray-400">
                          {row.lastDeliveredDate ? format(new Date(row.lastDeliveredDate), 'MMM d, yy') : ''}
                        </p>
                      </div>
                      <div className="col-span-2 text-right">
                        <p className="font-bold text-blue-600 text-sm">{row.bookedAhead || '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unmatched line items */}
      <UnmatchedItemsCard items={unmatchedItems} />

      {/* Demand by month (event start dates) */}
      <ServiceDemandChart events={events} serviceMap={serviceMap} />
    </div>
  );
}