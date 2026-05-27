import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, RefreshCw, Trash2, GitMerge } from 'lucide-react';
import { toast } from 'sonner';

export default function MergePartnerDuplicatesPanel({ onMergeComplete }) {
  const [scanning, setScanning] = useState(false);
  const [merging, setMerging] = useState(false);
  const [duplicates, setDuplicates] = useState(null); // null = not scanned yet
  const [mergeResult, setMergeResult] = useState(null);

  const handleScan = async () => {
    setScanning(true);
    setDuplicates(null);
    setMergeResult(null);
    try {
      const res = await base44.functions.invoke('mergePartnerDuplicates', { dryRun: true });
      setDuplicates(res.data.duplicates || []);
    } catch (e) {
      toast.error('Scan failed: ' + e.message);
    } finally {
      setScanning(false);
    }
  };

  const handleMerge = async () => {
    if (!window.confirm(
      `This will merge ${duplicates.length} duplicate(s): copy unique data from ReferralPartner into the Lead record, then permanently delete the ReferralPartner record. Continue?`
    )) return;

    setMerging(true);
    try {
      const res = await base44.functions.invoke('mergePartnerDuplicates', { dryRun: false });
      const d = res.data;
      setMergeResult(d);
      setDuplicates(null);
      toast.success(`Merged ${d.merged} duplicate(s)`);
      if (onMergeComplete) onMergeComplete();
    } catch (e) {
      toast.error('Merge failed: ' + e.message);
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-5 mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <GitMerge className="w-4 h-4 text-amber-600" />
            Duplicate Partner Cleanup
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Find contacts that exist as both a Lead (broker_lead) and a ReferralPartner. Merges data into the Lead and removes the duplicate.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleScan}
          disabled={scanning}
          className="gap-2 flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
          {scanning ? 'Scanning…' : 'Scan for Duplicates'}
        </Button>
      </div>

      {/* Scan results */}
      {duplicates !== null && (
        <div className="mt-4">
          {duplicates.length === 0 ? (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              No duplicates found. All partner records are clean.
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-3 text-sm font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Found {duplicates.length} duplicate{duplicates.length !== 1 ? 's' : ''}
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                {duplicates.map((d, i) => (
                  <div key={i} className="grid grid-cols-2 gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Lead (keep)</p>
                      <p className="font-medium text-gray-800">{d.leadName}</p>
                      <p className="text-xs text-gray-500">{d.email}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-0.5">ReferralPartner (delete)</p>
                      <p className="font-medium text-gray-800">{d.partnerName}</p>
                      <p className="text-xs text-gray-500">{d.partnerCompany || '—'}</p>
                      {d.partnerAgreementSignedDate && (
                        <p className="text-xs text-blue-600 mt-0.5">Agreement: {d.partnerAgreementSignedDate}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleMerge}
                disabled={merging}
                className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                size="sm"
              >
                <Trash2 className="w-4 h-4" />
                {merging ? 'Merging…' : `Merge & Delete ${duplicates.length} Duplicate${duplicates.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Merge result */}
      {mergeResult && (
        <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm font-medium">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Successfully merged {mergeResult.merged} record{mergeResult.merged !== 1 ? 's' : ''}.
          {mergeResult.errors?.length > 0 && (
            <span className="ml-2 text-red-600">{mergeResult.errors.length} error(s) — check console.</span>
          )}
        </div>
      )}
    </div>
  );
}