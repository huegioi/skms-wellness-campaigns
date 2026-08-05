import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
  ExternalLink, Mail, CheckCircle2, Archive, User, Building2, Calendar,
  BarChart3, DollarSign, FileText,
} from 'lucide-react';

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function scoreColor(score) {
  if (score == null) return 'bg-gray-100 text-gray-600';
  if (score < 40) return 'bg-red-100 text-red-700';
  if (score <= 60) return 'bg-amber-100 text-amber-700';
  return 'bg-green-100 text-green-700';
}

function InfoRow({ icon, label, value }) {
  return (
    <div>
      <div className="text-[11px] text-gray-400 flex items-center gap-1">{icon}{label}</div>
      <div className="text-gray-800 truncate">{value}</div>
    </div>
  );
}

/**
 * In-place review dialog for a single New Inquiries lead.
 * Shows the lead's context (contact, company, source, score, savings, survey
 * responses) and a row of actions: open results dashboard, draft outreach
 * email (Gmail DRAFT only — never sends), mark contacted, archive (with an
 * in-dialog confirm step), and open the full lead page.
 */
export default function NewInquiriesReviewDialog({
  open, lead, assessment, journey, responseCount, parsedScore, parsedSavings, onClose,
}) {
  const queryClient = useQueryClient();
  const [drafting, setDrafting] = useState(false);
  const [draftDone, setDraftDone] = useState(false);
  const [contacting, setContacting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [actioned, setActioned] = useState(false);

  if (!lead) return null;

  const emailDomain = (lead.email || '').split('@')[1] || '';
  const companyDisplay = lead.company || emailDomain || 'Unknown company';

  const journeyDashboardUrl = journey?.magic_key ? `/FitnessRoi/dashboard?k=${journey.magic_key}` : null;
  const mfsResultsUrl = assessment?.token ? `/MfsResults?t=${assessment.token}` : null;
  const resultsUrl = journeyDashboardUrl || mfsResultsUrl;

  const refreshLeads = () => queryClient.invalidateQueries({ queryKey: ['leads', 'company_inquiry'] });

  const handleDraft = async () => {
    setDrafting(true);
    try {
      const res = await base44.functions.invoke('draftInquiryOutreach', {
        lead_id: lead.id,
        response_count: responseCount,
      });
      if (res.data?.draft_created) {
        setDraftDone(true);
        refreshLeads(); // EmailLog linkage refreshed
      } else {
        toast.error(res.data?.error || 'Could not create draft');
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Could not create draft');
    } finally {
      setDrafting(false);
    }
  };

  const handleContacted = async () => {
    setContacting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      await base44.entities.Lead.update(lead.id, { last_contacted_date: today, status: 'warm' });
      setActioned(true);
      refreshLeads();
      setTimeout(onClose, 900);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Could not update lead');
    } finally {
      setContacting(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await base44.entities.Lead.update(lead.id, { is_archived: true });
      setActioned(true);
      refreshLeads();
      setTimeout(onClose, 900);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Could not archive lead');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 truncate">
            {lead.name || 'Inquiry'}
          </DialogTitle>
          <DialogDescription>
            {lead.email}{emailDomain ? ` · ${emailDomain}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <InfoRow icon={<Building2 className="w-3.5 h-3.5" />} label="Company" value={companyDisplay} />
            <InfoRow icon={<User className="w-3.5 h-3.5" />} label="Company size" value={lead.company_size || '—'} />
            <InfoRow icon={<FileText className="w-3.5 h-3.5" />} label="Source" value={lead.source || '—'} />
            <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="Created" value={fmtDate(lead.created_date)} />
          </div>

          {(parsedScore != null || parsedSavings != null || responseCount != null) && (
            <div className="flex flex-wrap gap-1.5">
              {parsedScore != null && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${scoreColor(parsedScore)}`}>
                  <BarChart3 className="w-3 h-3" /> Composite {parsedScore}/100
                </span>
              )}
              {parsedSavings != null && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 bg-[#264d44]/10 text-[#264d44]">
                  <DollarSign className="w-3 h-3" /> ${parsedSavings.toLocaleString()} projected savings
                </span>
              )}
              {responseCount != null && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                  {responseCount} team survey response{responseCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {actioned && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Done — this inquiry will drop off the list.
            </div>
          )}

          {draftDone && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Draft created in Gmail — review and send from your Drafts folder.
            </div>
          )}

          {confirmArchive ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm">
              <p className="text-amber-800 mb-2">Archive this inquiry? It will be hidden from the dashboard and excluded from all syncs.</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleArchive} disabled={archiving}>
                  {archiving ? 'Archiving…' : 'Confirm archive'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirmArchive(false)} disabled={archiving}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 pt-1">
              {resultsUrl && (
                <Button size="sm" variant="outline" asChild>
                  <a href={resultsUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" /> Open Results Dashboard
                  </a>
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleDraft} disabled={drafting || draftDone}>
                <Mail className="w-3.5 h-3.5" /> {draftDone ? 'Draft created' : drafting ? 'Drafting…' : 'Draft Outreach Email'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleContacted} disabled={contacting || actioned}>
                <CheckCircle2 className="w-3.5 h-3.5" /> {contacting ? 'Saving…' : 'Mark Contacted'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmArchive(true)} disabled={archiving || actioned}>
                <Archive className="w-3.5 h-3.5" /> Archive
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link to={`/Leads?leadId=${lead.id}&filter=quick_builder`}>Open Full Lead</Link>
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}