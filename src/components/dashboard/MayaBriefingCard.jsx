import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { base44 } from '@/api/base44Client';

export default function MayaBriefingCard() {
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchBriefing = async () => {
    setLoading(true);
    setError(false);
    const res = await base44.functions.invoke('mayaDailyBriefing', {}).catch(() => null);
    if (!res?.data?.briefing) {
      setError(true);
    } else {
      setBriefing(res.data);
    }
    setLoading(false);
  };

  useEffect(() => { fetchBriefing(); }, []);

  return (
    <div className="relative rounded-2xl p-[2px] mb-6" style={{
      background: 'linear-gradient(135deg, #013f7c 0%, #264d44 50%, #770142 100%)'
    }}>
      <div className="bg-white rounded-2xl px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #013f7c, #264d44)' }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-800 text-base leading-tight">Maya's Daily Briefing</h2>
              {briefing?.generated_at && (
                <p className="text-xs text-gray-400">
                  Generated at {new Date(briefing.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchBriefing}
            disabled={loading}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Generating...' : 'Refresh'}
          </Button>
        </div>

        {/* Content */}
        {loading && (
          <div className="flex items-center gap-3 py-6 text-gray-500">
            <RefreshCw className="w-4 h-4 animate-spin text-[#264d44]" />
            <span className="text-sm italic">Maya is preparing your briefing...</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-center gap-3 py-4 text-amber-700 bg-amber-50 rounded-xl px-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">Maya is taking a coffee break. Try refreshing.</span>
          </div>
        )}

        {briefing && !loading && !error && (
          <>
            <div className="prose prose-sm max-w-none text-gray-700 [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_ul]:my-1 [&_li]:my-0.5 [&_strong]:text-gray-900 [&_p]:my-1">
              <ReactMarkdown>{briefing.briefing}</ReactMarkdown>
            </div>

            {/* Stats bar */}
            {briefing.stats && (
              <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  <strong className="text-gray-700">{briefing.stats.overdue_partners}</strong> overdue partners
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  <strong className="text-gray-700">{briefing.stats.silent_clients}</strong> silent clients
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                  <strong className="text-gray-700">{briefing.stats.renewal_clients}</strong> renewal clients
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  <strong className="text-gray-700">{briefing.stats.active_partners}</strong> active partners
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}