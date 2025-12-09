import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  FileText, DollarSign, Calendar, CheckCircle, Clock, XCircle, AlertCircle,
  RefreshCw, Eye, Pencil, Send, Loader2, Trash2
} from 'lucide-react';
import InvoiceDialog from '@/components/invoices/InvoiceDialog';

const statusConfig = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Clock },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Send },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: XCircle }
};

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

  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-created_date')
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
    if (!confirm(`Send invoice ${invoice.invoice_number} to QuickBooks?`)) return;
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

  const handleDeleteInvoice = async (invoice) => {
    const message = invoice.quickbooks_id 
      ? `Delete invoice ${invoice.invoice_number}?\n\nThis will delete it from both the app AND QuickBooks.`
      : `Delete invoice ${invoice.invoice_number}?`;
    
    if (!confirm(message)) return;
    
    try {
      await deleteMutation.mutateAsync(invoice.id);
      alert('Invoice deleted successfully!');
    } catch (error) {
      alert(`Failed to delete: ${error.message}`);
    }
  };

  const filteredInvoices = invoices.filter(inv => 
    filterStatus === 'all' || inv.status === filterStatus
  );

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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: '#013f7c' }}>Invoices</h1>
            <p className="text-gray-600">Manage invoices and sync with QuickBooks</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowQBView(!showQBView)}
            >
              {showQBView ? 'Show Local' : 'View QuickBooks'}
            </Button>
            {!showQBView && (
              <Button 
                variant="outline" 
                onClick={handleSyncAll}
                disabled={syncingAll}
              >
                {syncingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Sync All
              </Button>
            )}
            {showQBView && (
              <Button 
                variant="outline" 
                onClick={handleLoadQBInvoices}
                disabled={loadingQB}
              >
                {loadingQB ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Refresh QB
              </Button>
            )}
            <Button 
              className="bg-[#264d44] hover:bg-[#1a3830]"
              onClick={() => setSelectedInvoice({ mode: 'create' })}
            >
              <FileText className="w-4 h-4 mr-2" /> Create Invoice
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <p className="text-sm text-gray-500 mb-1">Total Invoiced</p>
            <p className="text-3xl font-bold text-gray-800">${(showQBView ? qbTotalAmount : totalAmount).toLocaleString()}</p>
            {showQBView && qbInvoices.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">Local: ${totalAmount.toLocaleString()}</p>
            )}
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <p className="text-sm text-gray-500 mb-1">Paid</p>
            <p className="text-3xl font-bold text-green-600">${(showQBView ? qbPaidAmount : paidAmount).toLocaleString()}</p>
            {showQBView && qbInvoices.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">Local: ${paidAmount.toLocaleString()}</p>
            )}
          </div>
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <p className="text-sm text-gray-500 mb-1">Outstanding</p>
            <p className="text-3xl font-bold text-amber-600">${(showQBView ? qbOutstandingAmount : outstandingAmount).toLocaleString()}</p>
            {showQBView && qbInvoices.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">Local: ${outstandingAmount.toLocaleString()}</p>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl p-4 shadow-lg mb-6">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm text-gray-600">Filter:</span>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Invoices</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Date Range:</span>
              <Input 
                type="date" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[150px]"
                placeholder="From"
              />
              <span className="text-gray-400">to</span>
              <Input 
                type="date" 
                value={dateTo} 
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[150px]"
                placeholder="To"
              />
            </div>
            
            <span className="text-sm text-gray-500 ml-auto">
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
                  const status = statusConfig[invoice.status];
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
              const status = statusConfig[invoice.status];
              const StatusIcon = status.icon;
              const isSyncing = syncing === invoice.id;

              return (
                <div key={invoice.id} className="bg-white rounded-xl shadow-lg p-5 hover:shadow-xl transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold" style={{ color: '#264d44' }}>
                          {invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`}
                        </h3>
                        <Badge className={status.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </Badge>
                        {invoice.quickbooks_id && (
                          <Badge variant="outline" className="text-green-600 border-green-200">
                            QuickBooks Synced
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                        <span className="flex items-center gap-1">
                          <FileText className="w-4 h-4" /> {invoice.client_name}
                        </span>
                        {invoice.company && <span>{invoice.company}</span>}
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" /> ${invoice.total_amount?.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" /> Due: {new Date(invoice.due_date).toLocaleDateString()}
                        </span>
                        {invoice.paid_date && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" /> Paid: {new Date(invoice.paid_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>

                      {invoice.memo && (
                        <p className="text-sm text-gray-500 italic">{invoice.memo}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {invoice.quickbooks_id ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRefreshStatus(invoice)}
                          disabled={isSyncing}
                        >
                          {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </Button>
                      ) : invoice.status === 'draft' ? (
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700"
                          onClick={() => handleSyncToQB(invoice)}
                          disabled={isSyncing}
                        >
                          {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                          Send to QB
                        </Button>
                      ) : null}
                      
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
                        className="text-red-500 hover:text-red-700 hover:border-red-500"
                        onClick={() => handleDeleteInvoice(invoice)}
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
        {selectedInvoice && (
          <InvoiceDialog
            open={!!selectedInvoice}
            onOpenChange={(open) => !open && setSelectedInvoice(null)}
            invoice={selectedInvoice.invoice}
            mode={selectedInvoice.mode}
            clients={clients}
          />
        )}
      </div>
    </div>
  );
}