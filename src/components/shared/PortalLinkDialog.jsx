import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '@/lib/copyToClipboard';

/**
 * Fallback dialog shown when clipboard write fails (e.g. "Document is not focused").
 * Shows the portal URL in a read-only, pre-selected input with a synchronous Copy button.
 */
export default function PortalLinkDialog({ url, clientName, open, onClose }) {
  const inputRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [open]);

  const handleCopy = async () => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Portal link for {clientName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-500 mb-3">
          Couldn't copy automatically — use the Copy button below or select the link manually.
        </p>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            readOnly
            value={url || ''}
            className="flex-1 px-3 py-2 text-sm border rounded-md bg-gray-50 font-mono truncate"
          />
          <Button onClick={handleCopy} variant="outline">
            {copied ? <Check className="w-4 h-4 mr-1 text-green-600" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}