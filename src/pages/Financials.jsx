import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  FileText, DollarSign, Calendar, CheckCircle, Clock, XCircle, AlertCircle,
  RefreshCw, Eye, Pencil, Send, Loader2, Trash2, BarChart2, TrendingUp, Upload
} from 'lucide-react';
import InvoiceDialog from '@/components/invoices/InvoiceDialog';
import RevenueChart from '@/components/financials/RevenueChart';
import FinancialInformationSection from '@/components/dashboard/FinancialInformationSection';
import ExpenseManager from '@/components/dashboard/ExpenseManager';
import QuickBooksActionsPanel from '@/components/invoices/QuickBooksActionsPanel';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { INVOICE_STATUS_CONFIG as statusConfig } from '@/lib/statusConfig';

const TABS = [
  { id: 'dashboard', label: 'Revenue Chart', icon: BarChart2 },
  { id: 'overview', label: 'Overview', icon: TrendingUp },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'expenses', label: 'Expenses', icon: DollarSign },
];

export default function Financials() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen bg-[#f4f0e9]">
      {/* Page Header */}
      <div className="bg-white border-b px-4 md:px-8 pt-6 pb-0">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl sm:text-3xl font-bold mb-4" style={{ color: '#013f7c' }}>Financials</h1>
          {/* Sub-menu tabs */}
          <div className="flex gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-t-xl border-b-2 transition-all ${
                    isActive
                      ? 'border-[#264d44] text-[#264d44] bg-[#f4f0e9]'
                      : 'border-transparent text-gray-500 hover:text-gray-700 bg-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">
        {activeTab === 'dashboard' && <RevenueChart />}
        {activeTab === 'overview' && <FinancialInformationSection />}
        {activeTab === 'invoices' && <InvoicesPanel />}
        {activeTab === 'expenses' && <ExpenseManager />}
      </div>
    </div>
  );
}

function InvoicesPanel() {
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncResults, setSyncResults] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showQBView, setShowQBView] = useState(false);
  const [qbInvoices, setQBInvoices] = useState([]);
  const [loadingQB, setLoadingQB] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const queryClient = useQueryClient();

  const { data: rawInvoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 10000)
  });

  const { data: rawClients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  // Exclude demo/broker-demo records from dashboard metrics
  const invoices = rawInvoices.filter(i => !i.is_demo && !i.out_of_scope);
  const clients = rawClients.filter(c => !c.is_demo);

  const syncStatusMutation = useMutation({
    mutationFn: async (invoiceId) => {
      const response = await base44.functions.invoke('quickbooksSync', { action: 'syncInvoice', invoiceId });
      return response.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['invoices'] }); setSyncing(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: async (invoiceId) => {
      const response = await base44.functions.invoke('quickbooksSync', { action: 'deleteInvoice', invoiceId });
      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] })
  });

  const markPaidMutation = useMutation({
    mutationFn: async (invoice) => {
      const response = await base44.functions.invoke('quickbooksSync', { action: 'markAsPaid', invoiceId: invoice.id });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error) => {
      alert(`Failed to mark as paid: ${error.message}`);
    }
  });

  const handleSyncAll = async () => {
    setSyncingAll(true);
    setSyncResults(null);
    try {
      const response = await base44.functions.invoke('quickbooksSync', {
        action: 'syncAll',
        statusFilter: filterStatus === 'all' ? null : filterStatus,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null
      });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices-chart'] });
      setSyncResults(response.data);
    } catch (error) {
      alert(`Sync failed: ${error.message}`);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleRefreshStatus = async (invoice) => {
    setSyncing(invoice.id);
    try {
      await syncStatusMutation.mutateAsync(invoice.id);
    } catch (error) {
      alert(`Failed: ${error.message}`);
      setSyncing(null);
    }
  };

  const handleLoadQBInvoices = async () => {
    setLoadingQB(true);
    try {
      const response = await base44.functions.invoke('quickbooksSync', { action: 'listQBInvoices' });
      setQBInvoices(response.data.invoices);
      setShowQBView(true);
    } catch (error) {
      alert(`Failed: ${error.message}`);
    } finally {
      setLoadingQB(false);
    }
  };

  const handleSyncClients = async () => {
    if (!confirm('Import all customer data from QuickBooks?\n\nPulls customers and invoices into the app. Never creates clients.')) return;
    setSyncingAll(true);
    try {
      const response = await base44.functions.invoke('quickbooksSync', { action: 'syncClientsFromQB' });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      alert(`✓ Client sync complete!\n\n${response.data.created} created, ${response.data.updated} updated, ${response.data.failed} failed`);
    } catch (error) {
      alert(`Failed: ${error.message}`);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      alert('Invoice deleted successfully!');
    } catch (error) {
      alert(`Failed to delete invoice: ${error.message}`);
    } finally {
      setDeleteTarget(null);
    }
  };

  const filteredInvoices = invoices.filter(inv => filterStatus === 'all' || inv.status === filterStatus);
  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const paidAmount = filteredInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const outstandingAmount = filteredInvoices.filter(inv => ['sent', 'overdue', 'created_in_quickbooks'].includes(inv.status)).reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const qbFilteredInvoices = qbInvoices.filter(inv => filterStatus === 'all' || inv.status === filterStatus);
  const qbTotalAmount = qbFilteredInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const qbPaidAmount = qbFilteredInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const qbOutstandingAmount = qbFilteredInvoices.reduce((sum, inv) => sum + (inv.balance || 0), 0);

  if (isLoading) return <div className="flex items-center justify-center h-40 text-gray-400">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Header buttons */}
      <div className="flex flex-wrap gap-2 justify-end">
        <Button className="bg-[#264d44] hover:bg-[#1a3830]" size="sm" onClick={() => setSelectedInvoice({ mode: 'create' })}>
          <FileText className="w-4 h-4 mr-1" /> Create Invoice
        </Button>
      </div>

      <QuickBooksActionsPanel
        onImportClients={handleSyncClients}
        onRefreshStatus={handleSyncAll}
        onPreviewQB={() => showQBView ? setShowQBView(false) : handleLoadQBInvoices()}
        showQBView={showQBView}
        syncingAll={syncingAll}
        loadingQB={loadingQB}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Total Invoiced</p>
          <p className="text-2xl font-bold text-gray-800">${(showQBView ? qbTotalAmount : totalAmount).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Paid</p>
          <p className="text-2xl font-bold text-green-600">${(showQBView ? qbPaidAmount : paidAmount).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Outstanding</p>
          <p className="text-2xl font-bold text-amber-600">${(showQBView ? qbOutstandingAmount : outstandingAmount).toLocaleString()}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-4">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Invoices</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="created_in_quickbooks">In QuickBooks, not sent</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-sm text-gray-500">From:</span>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full sm:w-[150px]" />
            <span className="text-gray-400">to</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full sm:w-[150px]" />
          </div>
          <span className="text-sm text-gray-400 sm:ml-auto">{filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Sync Results */}
      {syncResults && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-800">Sync Results</h3>
            <Button size="sm" variant="ghost" onClick={() => setSyncResults(null)}>✕</Button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center"><p className="text-2xl font-bold">{syncResults.total}</p><p className="text-sm text-gray-500">Total</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-green-600">{syncResults.synced}</p><p className="text-sm text-gray-500">Synced</p></div>
            <div className="text-center"><p className="text-2xl font-bold text-red-600">{syncResults.failed}</p><p className="text-sm text-gray-500">Failed</p></div>
          </div>
        </div>
      )}

      {/* Invoice List */}
      {showQBView ? (
        <div className="space-y-3">
          {qbInvoices.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
              <FileText className="w-14 h-14 mx-auto mb-3 text-gray-200" />
              <p className="text-gray-400">No QuickBooks data loaded. Click "Refresh QB" to load.</p>
            </div>
          ) : (
            qbInvoices.filter(inv => filterStatus === 'all' || inv.status === filterStatus).map(invoice => {
              const status = statusConfig[invoice.status];
              const StatusIcon = status?.icon || Clock;
              return (
                <div key={invoice.quickbooks_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold" style={{ color: '#264d44' }}>{invoice.invoice_number}</h3>
                        <Badge className={status?.color}><StatusIcon className="w-3 h-3 mr-1" />{status?.label}</Badge>
                        {invoice.in_local_db
                          ? <Badge variant="outline" className="text-blue-600 border-blue-200">In Local DB</Badge>
                          : <Badge variant="outline" className="text-gray-400 border-gray-200">QB Only</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                        <span>{invoice.customer_name}</span>
                        <span className="font-semibold text-gray-700">${invoice.total_amount?.toLocaleString()}</span>
                        {invoice.balance > 0 && <span className="text-amber-600">Balance: ${invoice.balance?.toLocaleString()}</span>}
                        <span>Due: {new Date(invoice.due_date).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => {
                      if (invoice.in_local_db) {
                        const local = invoices.find(i => i.id === invoice.local_invoice_id);
                        if (local) setSelectedInvoice({ mode: 'view', invoice: local });
                      } else {
                        setSelectedInvoice({ mode: 'view-qb', invoice });
                      }
                    }}><Eye className="w-4 h-4" /></Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInvoices.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
              <FileText className="w-14 h-14 mx-auto mb-3 text-gray-200" />
              <p className="text-gray-400">No invoices found. Create your first invoice to get started.</p>
            </div>
          ) : (
            filteredInvoices.map(invoice => {
              const status = statusConfig[invoice.status];
              const StatusIcon = status?.icon || Clock;
              const isSyncing = syncing === invoice.id;
              return (
                <div key={invoice.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-5 hover:shadow-md transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold truncate" style={{ color: '#264d44' }}>
                          {invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}
                        </h3>
                        <Badge className={status?.color}><StatusIcon className="w-3 h-3 mr-1" />{status?.label}</Badge>
                        {invoice.quickbooks_id && (
                          <Badge variant="outline" className="text-green-600 border-green-200 text-xs">QB Synced</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                        <span className="truncate">{invoice.client_name}</span>
                        {invoice.company && <span className="truncate">{invoice.company}</span>}
                        <span className="font-semibold text-gray-700">${invoice.total_amount?.toLocaleString()}</span>
                        <span>Due: {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '—'}</span>
                        {invoice.paid_date && (
                          <span className="text-green-600">Paid: {new Date(invoice.paid_date).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {invoice.quickbooks_id ? (
                        <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 whitespace-nowrap" onClick={() => handleRefreshStatus(invoice)} disabled={isSyncing}>
                          {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          <span className="hidden sm:inline">Push Update</span>
                        </Button>
                      ) : invoice.status === 'draft' ? (
                        <Link to={createPageUrl('Proposals')} title="QuickBooks invoices are now created from the Proposals page via the review gate">
                          <Button size="sm" variant="outline" className="border-[#013f7c] text-[#013f7c] hover:bg-[#013f7c] hover:text-white whitespace-nowrap">
                            <Send className="w-4 h-4 mr-1" />
                            Create QB Invoice
                          </Button>
                        </Link>
                      ) : null}
                      {['sent', 'overdue', 'created_in_quickbooks'].includes(invoice.status) && (
                        <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 whitespace-nowrap"
                          onClick={() => markPaidMutation.mutate(invoice)}>
                          <CheckCircle className="w-4 h-4 mr-1" /> Mark Paid
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setSelectedInvoice({ mode: 'view', invoice })}><Eye className="w-4 h-4" /></Button>
                      {invoice.status === 'draft' && (
                        <Button size="sm" variant="outline" onClick={() => setSelectedInvoice({ mode: 'edit', invoice })}><Pencil className="w-4 h-4" /></Button>
                      )}
                      <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400" onClick={() => setDeleteTarget(invoice)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Dialogs */}
      {selectedInvoice && selectedInvoice.mode !== 'view-qb' && (
        <InvoiceDialog
          open={!!selectedInvoice}
          onOpenChange={(open) => !open && setSelectedInvoice(null)}
          invoice={selectedInvoice.invoice}
          mode={selectedInvoice.mode}
          clients={clients}
        />
      )}
      {selectedInvoice && selectedInvoice.mode === 'view-qb' && (
        <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>QuickBooks Invoice Details</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-gray-500">Invoice Number</p><p className="font-semibold">{selectedInvoice.invoice.invoice_number}</p></div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <Badge className={statusConfig[selectedInvoice.invoice.status]?.color}>{statusConfig[selectedInvoice.invoice.status]?.label}</Badge>
                </div>
              </div>
              <div><p className="text-sm text-gray-500">Customer</p><p className="font-semibold">{selectedInvoice.invoice.customer_name}</p></div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-gray-500">Issue Date</p><p className="font-semibold">{new Date(selectedInvoice.invoice.issue_date).toLocaleDateString()}</p></div>
                <div><p className="text-sm text-gray-500">Due Date</p><p className="font-semibold">{new Date(selectedInvoice.invoice.due_date).toLocaleDateString()}</p></div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between"><span className="text-gray-600">Total:</span><span className="font-semibold">${selectedInvoice.invoice.total_amount?.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Balance:</span><span className="font-semibold text-amber-600">${selectedInvoice.invoice.balance?.toLocaleString()}</span></div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete from QuickBooks</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>Delete invoice <strong>{deleteTarget?.invoice_number || `INV-${deleteTarget?.id?.slice(0, 8)}`}</strong>?</p>
                <p className="mt-1">Amount: <strong>${deleteTarget?.total_amount?.toLocaleString()}</strong></p>
                {deleteTarget?.quickbooks_id && (
                  <p className="mt-2 text-red-600 font-medium">This will delete it from both the app AND QuickBooks.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInvoice}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}