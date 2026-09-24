import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTitle } from '@/components/ui/dialog';
import { RecordDetailContent, RecordDetailFrame } from '@/components/shared/RecordDetailFrame';
import { Copy, Check, Link2 } from 'lucide-react';

export default function CohortLinksButton({ service }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(null);

  const base = window.location.origin;
  const day0 = `${base}/CohortAssessment?service_id=${service.id}&timing=day0`;
  const day14 = `${base}/CohortAssessment?service_id=${service.id}&timing=day14`;

  const copyLink = (url, label) => {
    navigator.clipboard.writeText(url);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const header = (
    <div className="min-w-0">
      <DialogTitle className="text-lg leading-tight">WHO-5 Assessment Links</DialogTitle>
      <p className="text-xs text-gray-500 mt-0.5 truncate">{service.name}</p>
    </div>
  );

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-[#264d44] border-[#264d44] hover:bg-[#264d44] hover:text-white text-xs"
        onClick={() => setOpen(true)}
      >
        <Link2 className="w-3.5 h-3.5" />
        Assessment Links
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <RecordDetailContent maxWidth="720px" fill={false}>
          <RecordDetailFrame header={header}>
            <p className="text-sm text-gray-500 mb-1">
              Copy these links to create QR codes or send them directly to participants.
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Tip: add <code className="bg-gray-100 px-1 rounded">&amp;client_id=CLIENT_ID</code> to any URL to associate responses with a specific client.
            </p>

            {/* Side by side once there is room; stacked on narrow windows. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Day 0 Baseline', url: day0, timing: 'day0', color: 'bg-blue-50 border-blue-200' },
                { label: 'Day 14 Check-In', url: day14, timing: 'day14', color: 'bg-green-50 border-green-200' },
              ].map(({ label, url, color }) => (
                <div key={label} className={`rounded-lg border p-3 min-w-0 ${color}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-700 truncate">{label}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-xs flex-shrink-0"
                      onClick={() => copyLink(url, label)}
                    >
                      {copied === label ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied === label ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 break-all font-mono bg-white rounded px-2 py-1.5 border border-gray-100">
                    {url}
                  </p>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                  >
                    Preview ↗
                  </a>
                </div>
              ))}
            </div>
          </RecordDetailFrame>
        </RecordDetailContent>
      </Dialog>
    </>
  );
}
