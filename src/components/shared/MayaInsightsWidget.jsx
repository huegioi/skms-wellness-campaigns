import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { RefreshCw, Mail, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useToast } from '@/components/ui/use-toast';

export default function MayaInsightsWidget({ recordType, recordId }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [draftingEmail, setDraftingEmail] = useState(false);
  const { toast } = useToast();

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('mayaContextualInsights', {
        record_type: recordType,
        record_id: recordId,
      });
      setInsights(res.data.insights);
    } catch (e) {
      setError('Failed to load insights. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDraftEmail = async () => {
    if (!insights) return;
    setDraftingEmail(true);
    try {
      const res = await base44.functions.invoke('mayaDraftEmail', {
        record_type: recordType,
        record_id: recordId,
        strategic_insights: insights,
      });
      const { subject, email_log_id } = res.data;
      toast({
        title: '✅ Draft saved!',
        description: (
          <span>
            <strong>{subject}</strong> — saved to Email Log.{' '}
            <a
              href={`/Leads`}
              className="underline text-indigo-600"
              onClick={(e) => {
                e.preventDefault();
                // Open Gmail compose with the draft subject as a hint
                window.open(`https://mail.google.com/mail/u/0/#drafts`, '_blank');
              }}
            >
              Open Gmail Drafts ↗
            </a>
          </span>
        ),
        duration: 8000,
      });
    } catch (e) {
      toast({
        title: 'Error drafting email',
        description: e?.response?.data?.error || 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDraftingEmail(false);
    }
  };

  useEffect(() => {
    if (recordId) fetchInsights();
  }, [recordId]);

  return (
    <div className="rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧠</span>
          <h3 className="text-sm font-bold text-indigo-900">Maya's Sales Director Insights</h3>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-indigo-600 hover:bg-indigo-100"
          onClick={fetchInsights}
          disabled={loading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span className="ml-1 text-xs">{loading ? 'Thinking...' : 'Refresh'}</span>
        </Button>
      </div>

      {/* Loading state */}
      {loading && !insights && (
        <div className="flex items-center gap-3 py-4">
          <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <p className="text-sm text-indigo-600 italic">Maya is analyzing this record…</p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 py-2">{error}</p>
      )}

      {insights && !loading && (
        <>
          <div className="prose prose-sm max-w-none text-indigo-950
            [&_ul]:mt-1 [&_ul]:space-y-2 [&_ul]:list-disc [&_ul]:pl-4
            [&_li]:text-sm [&_li]:leading-snug [&_li]:marker:text-indigo-400
            [&_strong]:text-indigo-900 [&_strong]:font-semibold
            [&_p]:text-sm [&_p]:leading-relaxed
            [&_h1]:text-sm [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-semibold">
            <ReactMarkdown>{insights}</ReactMarkdown>
          </div>

          {/* Draft Email Button */}
          <div className="mt-3 pt-3 border-t border-indigo-200">
            <Button
              size="sm"
              onClick={handleDraftEmail}
              disabled={draftingEmail}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 gap-1.5"
            >
              {draftingEmail ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Maya is drafting…
                </>
              ) : (
                <>
                  <Mail className="w-3.5 h-3.5" />
                  Draft Strategic Email
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {!insights && !loading && !error && (
        <p className="text-xs text-indigo-400 italic py-2">Click Refresh to generate insights.</p>
      )}
    </div>
  );
}