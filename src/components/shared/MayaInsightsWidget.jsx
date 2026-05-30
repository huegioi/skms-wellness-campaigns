import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function MayaInsightsWidget({ recordType, recordId }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

      {/* Content */}
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
        <div className="prose prose-sm max-w-none text-indigo-950 [&_ul]:space-y-1.5 [&_li]:text-sm [&_strong]:text-indigo-900 [&_p]:text-sm">
          <ReactMarkdown>{insights}</ReactMarkdown>
        </div>
      )}

      {!insights && !loading && !error && (
        <p className="text-xs text-indigo-400 italic py-2">Click Refresh to generate insights.</p>
      )}
    </div>
  );
}