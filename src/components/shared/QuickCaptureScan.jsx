import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Camera, Linkedin, Loader2, ScanText } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Compact business-card / LinkedIn screenshot capture bar.
 * Drop it into any form — it calls onExtract(fields) with whatever it could read
 * so the parent can merge the values into its own form state.
 *
 * Fields returned: name, email, phone, company, title, industry, company_size,
 * address, notes, outreach_channel, source
 */
export default function QuickCaptureScan({ onExtract, disabled = false, className = '' }) {
  const cardInputRef = useRef(null);
  const linkedInInputRef = useRef(null);
  const [scanningCard, setScanningCard] = useState(false);
  const [scanningLinkedIn, setScanningLinkedIn] = useState(false);

  const busy = scanningCard || scanningLinkedIn;

  const unwrap = (raw) => {
    if (typeof raw !== 'object' || raw === null) return {};
    if (raw.name || raw.email || raw.company || raw.title) return raw;
    return raw.data ?? raw;
  };

  const handleCard = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanningCard(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const raw = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract contact information from this business card image. Return ONLY the following fields if present:
- name (full name)
- email
- phone
- company (company/organization name)
- title (job title)
- industry (industry sector if stated)
- address (full mailing/office address as shown)
Fill in whatever you can find. If a field is not present, leave it as an empty string.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            company: { type: 'string' },
            title: { type: 'string' },
            industry: { type: 'string' },
            address: { type: 'string' },
          },
        },
      });
      const d = unwrap(raw);
      if (!d.name && !d.email && !d.company) {
        toast.warning('Scan complete but nothing readable — try a clearer photo.');
      } else {
        onExtract?.({
          name: d.name || '',
          email: d.email || '',
          phone: d.phone || '',
          company: d.company || '',
          title: d.title || '',
          industry: d.industry || '',
          address: d.address || '',
          source: 'Business card',
        });
        toast.success('Card scanned — review the fields before saving.');
      }
    } catch (err) {
      toast.error('Could not read card: ' + err.message);
    } finally {
      setScanningCard(false);
      e.target.value = '';
    }
  };

  const handleLinkedIn = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanningLinkedIn(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const raw = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract professional contact information from this LinkedIn profile screenshot. Return ONLY what you can see:
- name (full name)
- title (current job title/position)
- company (current company name)
- industry (industry sector if visible)
- company_size (number of employees if visible, e.g. "51-200")
- address (location shown on the profile, e.g. city/state)
- notes (any other relevant info like bio summary or mutual connections — do not duplicate the location here)
Leave fields as empty string if not visible.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            title: { type: 'string' },
            company: { type: 'string' },
            industry: { type: 'string' },
            company_size: { type: 'string' },
            address: { type: 'string' },
            notes: { type: 'string' },
          },
        },
      });
      const d = unwrap(raw);
      if (!d.name && !d.title && !d.company) {
        toast.warning('Scan complete but no info found — try a clearer screenshot.');
      } else {
        onExtract?.({
          name: d.name || '',
          title: d.title || '',
          company: d.company || '',
          industry: d.industry || '',
          company_size: d.company_size || '',
          address: d.address || '',
          notes: d.notes || '',
          outreach_channel: 'linkedin',
          source: 'LinkedIn',
        });
        toast.success('Profile scanned — review the fields before saving.');
      }
    } catch (err) {
      toast.error('Could not read screenshot: ' + err.message);
    } finally {
      setScanningLinkedIn(false);
      e.target.value = '';
    }
  };

  return (
    <div className={`rounded-lg border border-dashed border-[#013f7c]/30 bg-[#013f7c]/5 p-3 ${className}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <ScanText className="w-4 h-4 text-[#013f7c] shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#013f7c] leading-tight">Quick capture</p>
            <p className="text-xs text-gray-500 leading-tight">Business card or LinkedIn screenshot fills the form</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={() => linkedInInputRef.current?.click()}
            disabled={disabled || busy}
            className="bg-[#0077b5] hover:bg-[#005f91] gap-2"
          >
            {scanningLinkedIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Linkedin className="w-4 h-4" />}
            {scanningLinkedIn ? 'Reading…' : 'LinkedIn'}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => cardInputRef.current?.click()}
            disabled={disabled || busy}
            className="bg-[#013f7c] hover:bg-[#012d5a] gap-2"
          >
            {scanningCard ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {scanningCard ? 'Reading…' : 'Scan card'}
          </Button>
        </div>
      </div>
      <input
        ref={cardInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleCard}
      />
      <input
        ref={linkedInInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleLinkedIn}
      />
    </div>
  );
}
