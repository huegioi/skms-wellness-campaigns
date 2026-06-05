import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>WHO-5 Assessment Links</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500 mb-1">
            <strong>{service.name}</strong> — copy these links to create QR codes or send directly to participants.
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Tip: add <code className="bg-gray-100 px-1 rounded">&amp;client_id=CLIENT_ID</code> to any URL to associate responses with a specific client.
          </p>

          <div className="space-y-3">
            {[
              { label: 'Day 0 Baseline', url: day0, timing: 'day0', color: 'bg-blue-50 border-blue-200' },
              { label: 'Day 14 Check-In', url: day14, timing: 'day14', color: 'bg-green-50 border-green-200' },
            ].map(({ label, url, color }) => (
              <div key={label} className={`rounded-lg border p-3 ${color}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-700">{label}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 text-xs"
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
        </DialogContent>
      </Dialog>
    </>
  );
}