import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { RefreshCw, Mail, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useToast } from '@/components/ui/use-toast';

const SENDERS = [
  { label: 'William', value: 'william', email: 'william@skillfulmeans.life' },
  { label: 'Heather', value: 'heather', email: 'heather@skillfulmeans.life' },
];

function resolveSender(owner) {
  if (!owner) return 'william';
  return owner.toLowerCase().includes('heather') ? 'heather' : 'william';
}

export default function MayaInsightsWidget({ recordType, recordId, owner }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [draftingEmail, setDraftingEmail] = useState(false);
  const [showSenderPicker, setShowSenderPicker] = useState(false);
  const [selectedSender, setSelectedSender] = useState(() => resolveSender(owner));
  const { toast } = useToast();

  // Update default sender if owner prop changes
  useEffect(() => {
    setSelectedSender(resolveSender(owner));
  }, [owner]);

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

  const handleDraftEmail = async (senderValue) => {
    if (!insights) return;
    setShowSenderPicker(false);
    setDraftingEmail(true);
    try {
      const res = await base44.functions.invoke('mayaDraftEmail', {
        record_type: recordType,
        record_id: recordId,
        strategic_insights: insights,
        sender_override: senderValue,
      });
      const { subject, from_email } = res.data;
      const senderLabel = SENDERS.find(s => s.value === senderValue)?.label || senderValue;
      toast({
        title: '✅ Draft saved!',
        description: (
          <span>
            <strong>{subject}</strong> — saved as {senderLabel}'s draft.{' '}
            <a
              href="#"
              className="underline text-indigo-600"
              onClick={(e) => {
                e.preventDefault();
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
        duration: 5000,
      });
    } finally {
      setDraftingEmail(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50 p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg flex-shrink-0">🧠</span>
          <h3 className="text-sm font-bold text-indigo-900 leading-tight">Maya's Insights</h3>
        </div>
        {insights && (
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
        )}
      </div>

      {/* Idle — not yet run */}
      {!insights && !loading && !error && (
        <div className="flex flex-col items-center py-4 gap-2">
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            onClick={fetchInsights}
          >
            <span className="text-base leading-none">🧠</span>
            Get Maya's Insights
          </Button>
          <p className="text-xs text-indigo-400">Runs Maya's AI analysis — uses API credits</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center gap-3 py-4">
          <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <p className="text-sm text-indigo-600 italic">Maya is analyzing this record…</p>
        </div>
      )}

      {error && (
        <div className="space-y-2 py-2">
          <p className="text-xs text-red-500">{error}</p>
          <Button size="sm" variant="outline" className="text-xs h-7" onClick={fetchInsights}>Try again</Button>
        </div>
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

          {/* Draft Email Section */}
          <div className="mt-3 pt-3 border-t border-indigo-200">
            {!showSenderPicker ? (
              <Button
                size="sm"
                onClick={() => setShowSenderPicker(true)}
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
            ) : (
              <div className="bg-indigo-100 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-indigo-800">Draft email as:</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  {SENDERS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => {
                        setSelectedSender(s.value);
                        handleDraftEmail(s.value);
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-md text-xs font-semibold border transition-all ${
                        selectedSender === s.value
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50'
                      }`}
                    >
                      {s.label}
                      <span className="block font-normal text-[10px] opacity-70">{s.email}</span>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowSenderPicker(false)}
                  className="text-xs text-indigo-500 hover:text-indigo-700 w-full text-center"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
}