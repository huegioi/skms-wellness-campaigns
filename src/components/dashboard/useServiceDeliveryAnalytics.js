import { useMemo } from 'react';
import { useDashInvoices, useDashServices, useDashCalendarEvents } from './useDashboardData';
import { buildServiceMatcher, categoryCountLabel } from '@/lib/serviceMatching';

/**
 * Extracted from ServicesAnalytics — the full service-delivery analytics
 * computation (revenue, delivered, booked, gaps). Shared by ServicesAnalytics
 * and the BookedNotDeliveredTile on the financial Overview tab.
 */
export function useServiceDeliveryAnalytics() {
  const { data: rawInvoices = [], isLoading: loadingInvoices } = useDashInvoices();
  const { data: services = [], isLoading: loadingServices } = useDashServices();
  const { data: rawEvents = [], isLoading: loadingEvents } = useDashCalendarEvents();

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
  const isLoading = loadingInvoices || loadingServices || loadingEvents;

  return {
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
  };
}