import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, DollarSign, Calendar, CheckCircle,
  RefreshCw, Eye, Pencil, Send, Loader2, Trash2, Users, Upload
} from 'lucide-react';
import InvoiceDialog from '@/components/invoices/InvoiceDialog';
import QuickBooksActionsPanel from '@/components/invoices/QuickBooksActionsPanel';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { INVOICE_STATUS_CONFIG as statusConfig } from '@/lib/statusConfig';

export default function Invoices() {
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
  const [showOutOfScope, setShowOutOfScope] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const queryClient = useQueryClient();

  // Auto-open create dialog when navigated from Proposals page
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('create') === 'true') {
      const proposalId = params.get('proposal_id');
      setSelectedInvoice({ mode: 'create', preselectedProposalId: proposalId || null });
    }
  }, []);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date', 10000)
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const syncToQBMutation = useMutation({
    mutationFn: async (invoiceId) => {
      const response = await base44.functions.invoke('quickbooksSync', {
        action: 'createInvoice',
        invoiceId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSyncing(null);
    }
  });

  const syncStatusMutation = useMutation({
    mutationFn: async (invoiceId) => {
      const response = await base44.functions.invoke('quickbooksSync', {
        action: 'syncInvoice',
        invoiceId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSyncing(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (invoiceId) => {
      const response = await base44.functions.invoke('quickbooksSync', {
        action: 'deleteInvoice',
        invoiceId
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }
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
      setSyncResults(response.data);
    } catch (error) {
      alert(`Sync failed: ${error.message}`);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleSyncToQB = async (invoice) => {
    // Validate invoice has required fields for QuickBooks
    const missingFields = [];
    
    if (!invoice.client_email) missingFields.push('Client Email');
    if (!invoice.client_name) missingFields.push('Client Name');
    if (!invoice.line_items || invoice.line_items.length === 0) missingFields.push('Line Items (at least one)');
    if (!invoice.issue_date) missingFields.push('Issue Date');
    if (!invoice.due_date) missingFields.push('Due Date');
    
    // Check if line items have required fields
    const invalidLineItems = invoice.line_items?.filter(item => 
      !item.name && !item.description
    ) || [];
    
    if (invalidLineItems.length > 0) {
      missingFields.push(`Line Item Names/Descriptions (${invalidLineItems.length} items missing)`);
    }
    
    if (missingFields.length > 0) {
      alert(
        `Cannot send to QuickBooks - Missing required information:\n\n${missingFields.map(f => `• ${f}`).join('\n')}\n\nPlease edit the invoice to add this information before sending to QuickBooks.`
      );
      return;
    }
    
    if (!confirm(`Send invoice ${invoice.invoice_number || 'draft'} to QuickBooks?`)) return;
    setSyncing(invoice.id);
    try {
      await syncToQBMutation.mutateAsync(invoice.id);
      alert('Invoice synced to QuickBooks!');
    } catch (error) {
      alert(`Failed to sync: ${error.message}`);
      setSyncing(null);
    }
  };

  const handleRefreshStatus = async (invoice) => {
    setSyncing(invoice.id);
    try {
      await syncStatusMutation.mutateAsync(invoice.id);
    } catch (error) {
      alert(`Failed to refresh: ${error.message}`);
      setSyncing(null);
    }
  };

  const handleLoadQBInvoices = async () => {
    setLoadingQB(true);
    try {
      const response = await base44.functions.invoke('quickbooksSync', {
        action: 'listQBInvoices'
      });
      setQBInvoices(response.data.invoices);
      setShowQBView(true);
    } catch (error) {
      alert(`Failed to load QuickBooks invoices: ${error.message}`);
    } finally {
      setLoadingQB(false);
    }
  };

  const handleSyncClients = async () => {
    if (!confirm('Import all customer data from QuickBooks?\n\nPulls customers and invoices into the app. Never creates clients.')) return;
    
    setSyncingAll(true);
    try {
      const response = await base44.functions.invoke('quickbooksSync', {
        action: 'syncClientsFromQB'
      });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      alert(`✓ Client sync complete!\n\n${response.data.created} created, ${response.data.updated} updated, ${response.data.failed} failed`);
    } catch (error) {
      alert(`Failed to sync clients: ${error.message}`);
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

  const filteredInvoices = invoices.filter(inv => {
    if (!showOutOfScope && inv.out_of_scope) return false;
    return filterStatus === 'all' || inv.status === filterStatus;
  });

  // Calculate totals
  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const paidAmount = filteredInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const outstandingAmount = totalAmount - paidAmount;

  // Calculate QB totals
  const qbFilteredInvoices = qbInvoices.filter(inv => filterStatus === 'all' || inv.status === filterStatus);
  const qbTotalAmount = qbFilteredInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const qbPaidAmount = qbFilteredInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const qbOutstandingAmount = qbFilteredInvoices.reduce((sum, inv) => sum + (inv.balance || 0), 0);

  if (isLoading) {
    return <div className="min-h-screen bg-[#f4f0e9] flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-[#f4f0e9] p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: '#013f7c' }}>Invoices</h1>
            <p className="text-sm sm:text-base text-gray-600">Manage invoices and sync with QuickBooks</p>
          </div>
          <Button 
            className="bg-[#264d44] hover:bg-[#1a3830]"
            size="sm"
            onClick={() => setSelectedInvoice({ mode: 'create' })}
          >
            <FileText className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Create Invoice</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
            <p className="text-xs sm:text-sm text-gray-500 mb-1">Total Invoiced</p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-800">${(showQBView ? qbTotalAmount : totalAmount).toLocaleString()}</p>
            {showQBView && qbInvoices.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">Local: ${totalAmount.toLocaleString()}</p>
            )}
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
            <p className="text-xs sm:text-sm text-gray-500 mb-1">Paid</p>
            <p className="text-2xl sm:text-3xl font-bold text-green-600">${(showQBView ? qbPaidAmount : paidAmount).toLocaleString()}</p>
            {showQBView && qbInvoices.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">Local: ${paidAmount.toLocaleString()}</p>
            )}
          </div>
          <div className="bg-white rounded-xl p-4 sm:p-6 shadow-lg">
            <p className="text-xs sm:text-sm text-gray-500 mb-1">Outstanding</p>
            <p className="text-2xl sm:text-3xl font-bold text-amber-600">${(showQBView ? qbOutstandingAmount : outstandingAmount).toLocaleString()}</p>
            {showQBView && qbInvoices.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">Local: ${outstandingAmount.toLocaleString()}</p>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 shadow-lg mb-6">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-4">
            <span className="text-sm text-gray-600 hidden sm:inline">Filter:</span>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue />
              </SelectTrigger>
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

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <span className="text-sm text-gray-600">Date Range:</span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Input 
                  type="date" 
                  value={dateFrom} 
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="flex-1 sm:w-[150px]"
                  placeholder="From"
                />
                <span className="text-gray-400">to</span>
                <Input 
                  type="date" 
                  value={dateTo} 
                  onChange={(e) => setDateTo(e.target.value)}
                  className="flex-1 sm:w-[150px]"
                  placeholder="To"
                />
              </div>
            </div>

            <button
              onClick={() => setShowOutOfScope(prev => !prev)}
              className={`text-xs font-semibold rounded-lg border px-3 py-1.5 transition-colors ${
                showOutOfScope
                  ? 'border-amber-300 bg-amber-50 text-amber-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-amber-300 hover:text-amber-600'
              }`}
            >
              {showOutOfScope ? '✓ ' : ''}Show other-business invoices
            </button>
            <span className="text-sm text-gray-500 sm:ml-auto">
              {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Sync Results */}
        {syncResults && (
          <div className="bg-white rounded-xl p-4 shadow-lg mb-6">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-gray-800">Sync Results</h3>
              <Button size="sm" variant="ghost" onClick={() => setSyncResults(null)}>✕</Button>
            </div>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800">{syncResults.total}</p>
                <p className="text-sm text-gray-500">Total Processed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{syncResults.synced}</p>
                <p className="text-sm text-gray-500">Synced</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{syncResults.failed}</p>
                <p className="text-sm text-gray-500">Failed</p>
              </div>
            </div>
            {syncResults.results.filter(r => !r.synced).length > 0 && (
              <div className="border-t pt-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Errors:</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {syncResults.results.filter(r => !r.synced).map((result, idx) => (
                    <div key={idx} className="text-sm bg-red-50 rounded p-2">
                      <span className="font-medium">{result.invoice_number}:</span> {result.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Invoice List */}
        {showQBView ? (
          <div className="space-y-4">
            {qbInvoices.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center shadow-lg">
                <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No QuickBooks data loaded</h3>
                <p className="text-gray-500 mb-4">Click "Refresh QB" to load invoices from QuickBooks</p>
              </div>
            ) : (
              qbInvoices
                .filter(inv => filterStatus === 'all' || inv.status === filterStatus)
                .map(invoice => {
                  const status = statusConfig[invoice.status] || { label: invoice.status, color: 'bg-slate-100 text-slate-600 border-slate-300', icon: FileText };
                  const StatusIcon = status.icon;

                  return (
                    <div key={invoice.quickbooks_id} className="bg-white rounded-xl shadow-lg p-5 hover:shadow-xl transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold" style={{ color: '#264d44' }}>
                              {invoice.invoice_number}
                            </h3>
                            <Badge className={status.color}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {status.label}
                            </Badge>
                            {invoice.in_local_db ? (
                              <Badge variant="outline" className="text-blue-600 border-blue-200">
                                In Local DB
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-500 border-gray-300">
                                QB Only
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                            <span className="flex items-center gap-1">
                              <FileText className="w-4 h-4" /> {invoice.customer_name}
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4" /> ${invoice.total_amount?.toLocaleString()}
                            </span>
                            {invoice.balance > 0 && (
                              <span className="flex items-center gap-1 text-amber-600">
                                Balance: ${invoice.balance?.toLocaleString()}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" /> Due: {new Date(invoice.due_date).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (invoice.in_local_db) {
                                const localInvoice = invoices.find(inv => inv.id === invoice.local_invoice_id);
                                if (localInvoice) {
                                  setSelectedInvoice({ mode: 'view', invoice: localInvoice });
                                }
                              } else {
                                // Show QB-only invoice details
                                setSelectedInvoice({ mode: 'view-qb', invoice });
                              }
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                  })
                  )}
                  </div>
        ) : (
        <div className="space-y-4">
          {filteredInvoices.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center shadow-lg">
              <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No invoices yet</h3>
              <p className="text-gray-500 mb-4">Create your first invoice to get started</p>
            </div>
          ) : (
            filteredInvoices.map(invoice => {
              const status = statusConfig[invoice.status] || { label: invoice.status, color: 'bg-slate-100 text-slate-600 border-slate-300', icon: FileText };
              const StatusIcon = status.icon;
              const isSyncing = syncing === invoice.id;

              return (
                <div key={invoice.id} className="bg-white rounded-xl shadow-lg p-4 sm:p-5 hover:shadow-xl transition-shadow">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-lg sm:text-xl font-bold truncate" style={{ color: '#264d44' }}>
                          {invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}
                        </h3>
                        <Badge className={status.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </Badge>
                        {invoice.quickbooks_id && (
                          <Badge variant="outline" className="text-green-600 border-green-200 text-xs">
                            QB Synced
                          </Badge>
                        )}
                        {invoice.out_of_scope && (
                          <Badge variant="outline" className="text-amber-600 border-amber-200 text-xs">
                            Other Business
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-2">
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4 flex-shrink-0" /> 
                          <span className="truncate">{invoice.client_name}</span>
                        </span>
                        {invoice.company && <span className="truncate">{invoice.company}</span>}
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <DollarSign className="w-4 h-4 flex-shrink-0" /> ${invoice.total_amount?.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1 whitespace-nowrap">
                          <Calendar className="w-4 h-4 flex-shrink-0" /> Due: {new Date(invoice.due_date).toLocaleDateString()}
                        </span>
                        {invoice.paid_date && (
                          <span className="flex items-center gap-1 text-green-600 whitespace-nowrap">
                            <CheckCircle className="w-4 h-4 flex-shrink-0" /> Paid: {new Date(invoice.paid_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {invoice.memo && (
                        <p className="text-sm text-gray-500 italic line-clamp-2">{invoice.memo}</p>
                      )}
                    </div>

                    <div className="flex sm:flex-col lg:flex-row items-start sm:items-end lg:items-center gap-2 flex-shrink-0">
                      {invoice.quickbooks_id ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 whitespace-nowrap"
                          onClick={() => handleRefreshStatus(invoice)}
                          disabled={isSyncing}
                        >
                          {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                          <span className="hidden sm:inline">Push Update</span>
                        </Button>
                      ) : invoice.status === 'draft' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 whitespace-nowrap"
                          onClick={() => handleSyncToQB(invoice)}
                          disabled={isSyncing}
                        >
                          {isSyncing ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <Send className="w-4 h-4 sm:mr-2" />}
                          <span className="hidden sm:inline">Send to QuickBooks</span>
                        </Button>
                      ) : null}

                      {['sent', 'overdue', 'created_in_quickbooks'].includes(invoice.status) && (
                        <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 whitespace-nowrap"
                          onClick={() => markPaidMutation.mutate(invoice)}>
                          <CheckCircle className="w-4 h-4 sm:mr-1" />
                          <span className="hidden sm:inline">Mark Paid</span>
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedInvoice({ mode: 'view', invoice })}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>

                      {invoice.status === 'draft' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedInvoice({ mode: 'edit', invoice })}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                        onClick={() => setDeleteTarget(invoice)}
                      >
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

        {/* Invoice Dialog */}
        {selectedInvoice && selectedInvoice.mode !== 'view-qb' && (
          <InvoiceDialog
            open={!!selectedInvoice}
            onOpenChange={(open) => !open && setSelectedInvoice(null)}
            invoice={selectedInvoice.invoice}
            mode={selectedInvoice.mode}
            clients={clients}
            preselectedProposalId={selectedInvoice.preselectedProposalId || null}
          />
        )}

        {/* QB-Only Invoice Details Dialog */}
        {selectedInvoice && selectedInvoice.mode === 'view-qb' && (
          <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>QuickBooks Invoice Details</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Invoice Number</p>
                    <p className="font-semibold">{selectedInvoice.invoice.invoice_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge className={(statusConfig[selectedInvoice.invoice.status] || { color: 'bg-slate-100 text-slate-600 border-slate-300' }).color}>
                      {(statusConfig[selectedInvoice.invoice.status] || { label: selectedInvoice.invoice.status }).label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-semibold">{selectedInvoice.invoice.customer_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Issue Date</p>
                    <p className="font-semibold">{new Date(selectedInvoice.invoice.issue_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Due Date</p>
                    <p className="font-semibold">{new Date(selectedInvoice.invoice.due_date).toLocaleDateString()}</p>
                  </div>
                </div>
                {selectedInvoice.invoice.line_items && selectedInvoice.invoice.line_items.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Line Items</p>
                    <div className="space-y-2">
                      {selectedInvoice.invoice.line_items.map((item, idx) => (
                        <div key={idx} className="bg-gray-50 rounded p-3">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-gray-800">{item.name || item.description}</span>
                            <span className="font-semibold">${item.amount?.toLocaleString()}</span>
                          </div>
                          <div className="text-sm text-gray-600">
                            Qty: {item.quantity} × ${item.rate?.toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-semibold">${selectedInvoice.invoice.total_amount?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Balance:</span>
                    <span className="font-semibold text-amber-600">${selectedInvoice.invoice.balance?.toLocaleString()}</span>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
                  <p className="font-medium">QuickBooks Only Invoice</p>
                  <p className="text-blue-600">This invoice exists in QuickBooks but not in the local database. View it in QuickBooks for full details.</p>
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
    </div>
  );
}