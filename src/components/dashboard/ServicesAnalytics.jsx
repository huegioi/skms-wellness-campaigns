import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, CheckCircle2, CalendarClock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { buildServiceMatcher, categoryCountLabel, CATEGORY_LABELS } from '@/lib/serviceMatching';
import UnmatchedItemsCard from './UnmatchedItemsCard';
import ServiceDemandChart from './ServiceDemandChart';

export default function ServicesAnalytics() {
  const { data: rawInvoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list()
  });
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list()
  });
  const { data: rawEvents = [] } = useQuery({
    queryKey: ['calendarEvents'],
    queryFn: () => base44.entities.CalendarEvent.list('-start_date', 2000)
  });

  const invoices = useMemo(() => rawInvoices.filter(i => !i.is_demo), [rawInvoices]);
  const events = useMemo(() => rawEvents.filter(e => !e.is_demo), [rawEvents]);

  const serviceMap = useMemo(() => {
    const m = {};
    services.forEach(s => { m[s.id] = s; });
    return m;
  }, [services]);

  const matchService = useMemo(() => buildServiceMatcher(services), [services]);

  // Process invoice line items — canonically matched to Services
  const { serviceRevenue, unmatchedItems, totalRevenue } = useMemo(() => {
    const rev = {};
    const unmatched = [];
    let total = 0;

    invoices.forEach(invoice => {
      if (!invoice.line_items || !Array.isArray(invoice.line_items)) return;
      const invoiceNumber = invoice.invoice_number || (invoice.id ? invoice.id.slice(-8) : 'N/A');
      invoice.line_items.forEach(item => {
        const quantity = item.quantity || 1;
        const amount = item.amount || 0;
        const service = matchService(item);

        if (service) {
          if (!rev[service.id]) {
            rev[service.id] = { serviceId: service.id, name: service.name, category: service.category, revenue: 0, count: 0 };
          }
          rev[service.id].revenue += amount;
          rev[service.id].count += quantity;
        } else {
          unmatched.push({
            description: item.description || '(no description)',
            quantity,
            amount,
            invoiceNumber
          });
        }
        total += amount;
      });
    });

    return { serviceRevenue: rev, unmatchedItems: unmatched, totalRevenue: total };
  }, [invoices, matchService]);

  // Process calendar events: delivered (completed) + booked ahead (upcoming)
  const { deliveredByService, bookedByService, deliveredCategoryBreakdown } = useMemo(() => {
    const delivered = {};
    const booked = {};
    const catBreakdown = {};
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    events.forEach(e => {
      if (!e.service_id || !serviceMap[e.service_id]) return;

      if (e.completed) {
        if (!delivered[e.service_id]) delivered[e.service_id] = { count: 0, lastDate: null };
        delivered[e.service_id].count++;
        const dateStr = e.completed_date || e.start_date;
        if (dateStr) {
          if (!delivered[e.service_id].lastDate || new Date(dateStr) > new Date(delivered[e.service_id].lastDate)) {
            delivered[e.service_id].lastDate = dateStr;
          }
        }
        const cat = serviceMap[e.service_id]?.category;
        if (cat) catBreakdown[cat] = (catBreakdown[cat] || 0) + 1;
      } else if (e.start_date && new Date(e.start_date) >= startOfToday) {
        booked[e.service_id] = (booked[e.service_id] || 0) + 1;
      }
    });

    return { deliveredByService: delivered, bookedByService: booked, deliveredCategoryBreakdown: catBreakdown };
  }, [events, serviceMap]);

  // Combined per-service table: revenue + delivery side by side
  const serviceRows = useMemo(() => {
    const allServiceIds = new Set([
      ...Object.keys(serviceRevenue),
      ...Object.keys(deliveredByService),
      ...Object.keys(bookedByService)
    ]);

    return Array.from(allServiceIds).map(id => {
      const service = serviceMap[id];
      const rev = serviceRevenue[id];
      const del = deliveredByService[id];
      const category = service?.category || rev?.category;
      return {
        serviceId: id,
        name: service?.name || rev?.name || 'Unknown Service',
        category,
        revenue: rev?.revenue || 0,
        invoiceCount: rev?.count || 0,
        deliveredCount: del?.count || 0,
        lastDeliveredDate: del?.lastDate || null,
        bookedAhead: bookedByService[id] || 0,
        hasGap: (rev?.revenue || 0) > 0 && (del?.count || 0) === 0
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [serviceRevenue, deliveredByService, bookedByService, serviceMap]);

  // KPIs
  const totalDelivered = Object.values(deliveredByService).reduce((s, d) => s + d.count, 0);
  const totalBooked = Object.values(bookedByService).reduce((s, c) => s + c, 0);
  const gapRows = serviceRows.filter(r => r.hasGap);
  const gapRevenue = gapRows.reduce((s, r) => s + r.revenue, 0);

  const deliveredBreakdownStr = Object.entries(deliveredCategoryBreakdown)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => categoryCountLabel(cat, count))
    .join(' · ');

  const hasData = serviceRows.length > 0 || unmatchedItems.length > 0;

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
                <p className="text-2xl font-bold">${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#264d44]/10">
                <CheckCircle2 className="w-5 h-5 text-[#264d44]" />
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
                <p className="text-2xl font-bold text-amber-700">${gapRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-gray-400 mt-0.5">{gapRows.length} service{gapRows.length !== 1 ? 's' : ''} with 0 deliveries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-service table: revenue + delivery side by side */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg" style={{ color: '#264d44' }}>
            Revenue vs Delivery by Service
          </CardTitle>
          <p className="text-sm text-gray-500">
            Invoiced revenue and delivered sessions side by side — gaps flag services sold but never scheduled.
          </p>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {serviceRows.length === 0 ? (
            <div className="h-[200px] flex items-center justify-center text-gray-400">No service data yet</div>
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
                          ${row.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </p>
                        <p className="text-xs text-gray-400">
                          {row.invoiceCount > 0 ? categoryCountLabel(row.category, row.invoiceCount) : '—'}
                        </p>
                      </div>
                      <div className="col-span-2 text-right">
                        <p className="font-bold text-[#264d44] text-sm">{row.deliveredCount || '—'}</p>
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