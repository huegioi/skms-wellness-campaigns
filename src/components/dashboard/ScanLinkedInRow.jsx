import React, { useState } from 'react';
import { Linkedin, Loader2, Search, Pencil, RotateCw, Check, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const PROFILE_RE = /^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[^\s/?#]+/i;

/** LinkedIn's own people search, prefilled with name + company. */
export function linkedInSearchUrl(scan) {
  const q = [scan.name, scan.company].filter(Boolean).join(' ').trim() || scan.email;
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(q)}`;
}

/**
 * LinkedIn line on a conference-scan card. The profile is found automatically
 * (findScanLinkedIn runs when the scan comes in, or when the dashboard sees a
 * scan that was never looked up). Found → "Connect on LinkedIn" opens their
 * profile, with the matched headline underneath so you can tell it's the
 * right person. Not found → "Find on LinkedIn" opens LinkedIn's people
 * search. Either way a link can be pasted or corrected by hand.
 */
export default function ScanLinkedInRow({ scan, searching, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(scan.linkedin_url || '');
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const status = scan.linkedin_status;
  const hasLink = !!scan.linkedin_url && (status === 'found' || status === 'manual');
  const isSearching = searching || retrying || status === 'searching' || (!status && !!scan.name);

  const saveLink = async () => {
    const url = draft.trim();
    if (url && !PROFILE_RE.test(url)) {
      toast.error('Paste a profile link that starts with linkedin.com/in/');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.ScanLead.update(scan.id, url
        ? { linkedin_url: url.replace(/^http:/i, 'https:'), linkedin_status: 'manual', linkedin_headline: '' }
        : { linkedin_url: '', linkedin_status: 'not_found', linkedin_headline: '' });
      setEditing(false);
      onChanged?.();
    } catch {
      toast.error('Could not save the link');
    } finally {
      setSaving(false);
    }
  };

  const searchAgain = async () => {
    setRetrying(true);
    try {
      await base44.entities.ScanLead.update(scan.id, { linkedin_status: 'searching', linkedin_url: '' });
      const res = await base44.functions.invoke('findScanLinkedIn', { scan_id: scan.id });
      if (res?.data?.status === 'found') toast.success('Found them on LinkedIn');
      else toast('No confident match. Try Find on LinkedIn.');
    } catch {
      toast.error('LinkedIn search failed');
    } finally {
      setRetrying(false);
      onChanged?.();
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <Linkedin className="w-4 h-4 text-[#0a66c2] flex-shrink-0" />
        <Input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveLink(); if (e.key === 'Escape') setEditing(false); }}
          placeholder="https://www.linkedin.com/in/…"
          className="h-9 sm:h-8 text-sm sm:text-xs"
        />
        <Button size="icon" variant="outline" className="h-9 w-9 sm:h-8 sm:w-8 flex-shrink-0" disabled={saving} onClick={saveLink} aria-label="Save link">
          <Check className="w-4 h-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-9 w-9 sm:h-8 sm:w-8 flex-shrink-0" onClick={() => setEditing(false)} aria-label="Cancel">
          <X className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  if (isSearching && !hasLink) {
    return (
      <p className="text-xs text-gray-500 flex items-center gap-1.5">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0a66c2]" /> Looking them up on LinkedIn…
      </p>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {hasLink ? (
          <Button asChild size="sm" className="bg-[#0a66c2] hover:bg-[#004182] text-white gap-1.5 text-xs">
            <a href={scan.linkedin_url} target="_blank" rel="noopener noreferrer">
              <Linkedin className="w-3.5 h-3.5" /> Connect on LinkedIn
            </a>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline" className="border-[#0a66c2]/40 text-[#0a66c2] hover:bg-[#0a66c2]/5 gap-1.5 text-xs">
            <a href={linkedInSearchUrl(scan)} target="_blank" rel="noopener noreferrer">
              <Search className="w-3.5 h-3.5" /> Find on LinkedIn
            </a>
          </Button>
        )}
        <button
          type="button"
          onClick={() => { setDraft(scan.linkedin_url || ''); setEditing(true); }}
          className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 min-h-[32px]"
        >
          <Pencil className="w-3 h-3" /> {hasLink ? 'Wrong person?' : 'Paste link'}
        </button>
        {scan.name && (
          <button
            type="button"
            onClick={searchAgain}
            className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 min-h-[32px]"
          >
            <RotateCw className="w-3 h-3" /> Search again
          </button>
        )}
      </div>
      {hasLink && status === 'found' && scan.linkedin_headline && (
        <p className="text-[11px] text-gray-500 leading-snug">Match: {scan.linkedin_headline}</p>
      )}
      {!hasLink && (
        <p className="text-[11px] text-gray-400 leading-snug">
          {scan.name ? 'No confident match found automatically.' : 'No name given, so it couldn’t be searched.'}
        </p>
      )}
    </div>
  );
}
