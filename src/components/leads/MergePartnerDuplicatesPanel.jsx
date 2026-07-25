import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, GitMerge } from 'lucide-react';
import { toast } from 'sonner';

// This component is now trigger-only — called from Leads page header button.
// It renders the results panel (shown inline below the header) only when duplicates are found.
export default function MergePartnerDuplicatesPanel({ onMergeComplete, scanning, onScan, duplicates, mergeResult }) {
  const [merging, setMerging] = useState(false);

  const handleMerge = async () => {
    if (!window.confirm(
      `This will merge ${duplicates.length} duplicate(s): copy unique data from ReferralPartner into the Lead record. The ReferralPartner record is kept intact. Continue?`
    )) return;

    setMerging(true);
    try {
      const res = await base44.functions.invoke('mergePartnerDuplicates', { dryRun: false });
      const d = res.data;
      toast.success(`Merged ${d.merged} duplicate(s)`);
      if (onMergeComplete) onMergeComplete(d);
    } catch (e) {
      toast.error('Merge failed: ' + e.message);
    } finally {
      setMerging(false);
    }
  };

  // Only render if there's something to show
  if (duplicates === null && !mergeResult) return null;

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-5 mb-6">
      {/* Scan results */}
      {duplicates !== null && (
        <div>
          {duplicates.length === 0 ? (
            <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              No duplicates found. All partner records are clean.
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-3 text-sm font-medium">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                Found {duplicates.length} duplicate{duplicates.length !== 1 ? 's' : ''} — review below before merging
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
                      <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide mb-0.5">ReferralPartner (kept)</p>
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
                <GitMerge className="w-4 h-4" />
                {merging ? 'Merging…' : `Merge ${duplicates.length} Duplicate${duplicates.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Merge result */}
      {mergeResult && (
        <div>
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Successfully merged {mergeResult.merged} record{mergeResult.merged !== 1 ? 's' : ''}. Partner records were kept intact.
            {mergeResult.errors?.length > 0 && (
              <span className="ml-2 text-red-600">{mergeResult.errors.length} error(s) — check console.</span>
            )}
          </div>
          {mergeResult.warnings?.length > 0 && (
            <div className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="font-semibold mb-1">Referrals still referencing merged partners (records not deleted):</p>
              <ul className="list-disc list-inside space-y-0.5">
                {mergeResult.warnings.map(w => (
                  <li key={w.partnerId}>{w.partnerName}: {w.referralCount} referral{w.referralCount !== 1 ? 's' : ''}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}