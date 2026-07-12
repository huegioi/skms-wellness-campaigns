import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const STALE_TIME = 60_000;

/** All clients — used by ClientInformationSection, FollowUpQueue */
export function useDashClients() {
  return useQuery({
    queryKey: ['dash-clients'],
    queryFn: () => base44.entities.Client.list(),
    staleTime: STALE_TIME,
  });
}

/** All proposals — used by ClientInformationSection */
export function useDashProposals() {
  return useQuery({
    queryKey: ['dash-proposals'],
    queryFn: () => base44.entities.Proposal.list(),
    staleTime: STALE_TIME,
  });
}

/** All invoices (high limit for financial rollups) — used by ClientInformationSection, FinancialInformationSection, FinancialSummary, ServicesAnalytics, CustomerLTVCard */
export function useDashInvoices() {
  return useQuery({
    queryKey: ['dash-invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 10000),
    staleTime: STALE_TIME,
  });
}

/** Recent leads — used by ClientInformationSection */
export function useDashLeads() {
  return useQuery({
    queryKey: ['dash-leads'],
    queryFn: () => base44.entities.Lead.list('-created_date', 500),
    staleTime: STALE_TIME,
  });
}

/** All client tasks — used by ClientInformationSection */
export function useDashTasks() {
  return useQuery({
    queryKey: ['dash-tasks'],
    queryFn: () => base44.entities.ClientTask.list(),
    staleTime: STALE_TIME,
  });
}

/** All services — used by ServicesAnalytics */
export function useDashServices() {
  return useQuery({
    queryKey: ['dash-services'],
    queryFn: () => base44.entities.Service.list(),
    staleTime: STALE_TIME,
  });
}

/** All QuickBooks expenses — used by FinancialInformationSection, FinancialSummary, ReportsSection */
export function useDashExpenses() {
  return useQuery({
    queryKey: ['dash-expenses'],
    queryFn: () => base44.entities.QuickBooksExpense.list(),
    staleTime: STALE_TIME,
  });
}

/** All QuickBooks income — used by ReportsSection */
export function useDashIncome() {
  return useQuery({
    queryKey: ['dash-income'],
    queryFn: () => base44.entities.QuickBooksIncome.list(),
    staleTime: STALE_TIME,
  });
}

/** Calendar events (start-date desc, high limit) — used by ClientInformationSection, ServicesAnalytics */
export function useDashCalendarEvents() {
  return useQuery({
    queryKey: ['dash-calendar-events'],
    queryFn: () => base44.entities.CalendarEvent.list('-start_date', 2000),
    staleTime: STALE_TIME,
  });
}

/** All referrals — used by ClientInformationSection, ActionableReviewQueue */
export function useDashReferrals() {
  return useQuery({
    queryKey: ['dash-referrals'],
    queryFn: () => base44.entities.Referral.list('-created_date', 500),
    staleTime: STALE_TIME,
  });
}

/** Client interactions (date desc) — used by FollowUpQueue */
export function useDashInteractions() {
  return useQuery({
    queryKey: ['dash-interactions'],
    queryFn: () => base44.entities.ClientInteraction.list('-date', 500),
    staleTime: STALE_TIME,
  });
}