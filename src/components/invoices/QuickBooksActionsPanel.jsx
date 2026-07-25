import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Download, RefreshCw, Eye, Loader2, AlertTriangle,
  Send, Upload, CheckCircle, Trash2
} from 'lucide-react';

const TO_QB_BTN = 'border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400';

export default function QuickBooksActionsPanel({
  onImportClients,
  onRefreshStatus,
  onPreviewQB,
  showQBView,
  syncingAll,
  loadingQB,
}) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── From QuickBooks ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Download className="w-4 h-4 text-blue-600" />
            <h3 className="font-semibold text-gray-800 text-sm">From QuickBooks</h3>
            <span className="text-xs text-gray-400">reads into the app</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <Button variant="outline" size="sm" onClick={onImportClients} disabled={syncingAll}>
              {syncingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Import from QuickBooks
            </Button>
            <Button variant="outline" size="sm" onClick={onRefreshStatus} disabled={syncingAll}>
              {syncingAll ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Refresh Invoice Status
            </Button>
            <Button variant="outline" size="sm" onClick={onPreviewQB} disabled={loadingQB}>
              {loadingQB ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
              {showQBView ? 'Back to Local' : 'Preview QuickBooks Invoices'}
            </Button>
          </div>
          <div className="text-xs text-gray-400 space-y-0.5">
            <p><span className="font-medium text-gray-500">Import</span> — Pulls customers and invoices into the app. Never creates clients.</p>
            <p><span className="font-medium text-gray-500">Refresh</span> — Updates paid/overdue status on invoices already in the app. Cannot import anything new.</p>
            <p><span className="font-medium text-gray-500">Preview</span> — Read-only. Shows what's in QuickBooks without changing anything.</p>
          </div>
        </div>

        {/* ── To QuickBooks ── */}
        <div className="lg:border-l lg:border-amber-200 lg:pl-6">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="font-semibold text-gray-800 text-sm">To QuickBooks</h3>
            <span className="text-xs text-gray-400">writes to your accounting system</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium ${TO_QB_BTN}`}>
              <Send className="w-3.5 h-3.5" /> Send to QuickBooks
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium ${TO_QB_BTN}`}>
              <Upload className="w-3.5 h-3.5" /> Push Update
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium ${TO_QB_BTN}`}>
              <CheckCircle className="w-3.5 h-3.5" /> Mark Paid
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-300 bg-red-50 text-red-700 text-xs font-medium">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </span>
          </div>
          <p className="text-xs text-gray-400">
            These actions appear per-invoice below. They modify your QuickBooks account —
            a failure in QuickBooks aborts the local change so the two never diverge silently.
          </p>
        </div>
      </div>
    </div>
  );
}