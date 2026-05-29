import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw, AlertCircle, CheckSquare, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { base44 } from '@/api/base44Client';

function isToday(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

// Parse "Action:" lines from briefing text into checkable items
function parseActionItems(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const actions = [];
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (/^[-*•]?\s*\*?\*?Action:/i.test(trimmed) || /^[-*•]\s+.+Action:/i.test(trimmed)) {
      const clean = trimmed
        .replace(/^[-*•]\s*/, '')
        .replace(/^\*\*/, '')
        .replace(/\*\*$/, '')
        .trim();
      actions.push({ key: `action_${idx}`, text: clean, lineIdx: idx });
    }
  });
  return actions;
}

// Replace action lines in markdown with placeholder so we can render them as checkboxes
function splitBriefingAroundActions(text, actionItems) {
  if (!text || actionItems.length === 0) return [{ type: 'text', content: text }];
  
  const lines = text.split('\n');
  const actionLineIdxs = new Set(actionItems.map(a => a.lineIdx));
  const parts = [];
  let buffer = [];

  lines.forEach((line, idx) => {
    if (actionLineIdxs.has(idx)) {
      if (buffer.length > 0) {
        parts.push({ type: 'text', content: buffer.join('\n') });
        buffer = [];
      }
      const action = actionItems.find(a => a.lineIdx === idx);
      parts.push({ type: 'action', action });
    } else {
      buffer.push(line);
    }
  });

  if (buffer.length > 0) {
    parts.push({ type: 'text', content: buffer.join('\n') });
  }

  return parts;
}

function CheckedBadge({ info }) {
  const time = new Date(info.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 ml-2 font-medium">
      ✓ {info.name} {time}
    </span>
  );
}

function ActionItem({ action, checkedItems, onCheck, currentUserName }) {
  const checked = checkedItems?.[action.key];
  const isChecked = !!checked;

  // Strip "Action:" prefix for display
  const displayText = action.text.replace(/^Action:\s*/i, '');

  return (
    <div
      className={`flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors border ${
        isChecked
          ? 'bg-green-50 border-green-200'
          : 'bg-blue-50 border-blue-100 hover:bg-blue-100'
      }`}
      onClick={() => onCheck(action.key, isChecked)}
    >
      <div className="mt-0.5 flex-shrink-0">
        {isChecked
          ? <CheckSquare className="w-4 h-4 text-green-600" />
          : <Square className="w-4 h-4 text-blue-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${isChecked ? 'line-through text-gray-400' : 'text-gray-700 font-medium'}`}>
          {displayText}
        </span>
        {isChecked && <CheckedBadge info={checked} />}
      </div>
    </div>
  );
}

export default function MayaBriefingCard() {
  const [record, setRecord] = useState(null); // MayaBriefing entity record
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Load current user
  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  const loadOrGenerate = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(false);

    // Try to load today's briefing from entity
    if (!forceRefresh) {
      const records = await base44.entities.MayaBriefing.list('-generated_at', 1).catch(() => []);
      const latest = records[0];
      if (latest && isToday(latest.generated_at)) {
        setRecord(latest);
        setLoading(false);
        return;
      }
    }

    // Generate new briefing
    setGenerating(true);
    const res = await base44.functions.invoke('mayaDailyBriefing', {}).catch(() => null);
    setGenerating(false);

    if (!res?.data?.briefing) {
      setError(true);
      // Still show the last record if we have one, even if stale
      if (!record) {
        const fallback = await base44.entities.MayaBriefing.list('-generated_at', 1).catch(() => []);
        if (fallback[0]) setRecord(fallback[0]);
      }
    } else {
      const { briefing, stats, generated_at } = res.data;
      // Save to entity
      const newRecord = await base44.entities.MayaBriefing.create({
        briefing_text: briefing,
        stats: stats || {},
        generated_at: generated_at || new Date().toISOString(),
        checked_items: {},
      }).catch(() => null);

      if (newRecord) {
        setRecord(newRecord);
      } else {
        // Fallback: display without saving
        setRecord({ briefing_text: briefing, stats, generated_at: generated_at || new Date().toISOString(), checked_items: {} });
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadOrGenerate(false); }, []);

  const handleCheck = async (key, isCurrentlyChecked) => {
    if (!record) return;
    const userName = currentUser?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0] || 'User';
    const updatedCheckedItems = { ...(record.checked_items || {}) };

    if (isCurrentlyChecked) {
      delete updatedCheckedItems[key];
    } else {
      updatedCheckedItems[key] = { name: userName, timestamp: new Date().toISOString() };
    }

    const updated = { ...record, checked_items: updatedCheckedItems };
    setRecord(updated);

    if (record.id) {
      await base44.entities.MayaBriefing.update(record.id, { checked_items: updatedCheckedItems }).catch(() => {});
    }
  };

  const actionItems = parseActionItems(record?.briefing_text || '');
  const briefingParts = splitBriefingAroundActions(record?.briefing_text || '', actionItems);
  const isStale = record?.generated_at && !isToday(record.generated_at);

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
              {record?.generated_at && (
                <p className="text-xs text-gray-400">
                  {isStale
                    ? `From ${new Date(record.generated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
                    : `Generated at ${new Date(record.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  }
                  {isStale && <span className="ml-1 text-amber-500">(yesterday)</span>}
                </p>
              )}
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => loadOrGenerate(true)}
            disabled={loading || generating}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3 h-3 ${(loading || generating) ? 'animate-spin' : ''}`} />
            {generating ? 'Generating...' : loading ? 'Loading...' : 'Refresh Briefing'}
          </Button>
        </div>

        {/* Loading */}
        {(loading || generating) && (
          <div className="flex items-center gap-3 py-6 text-gray-500">
            <RefreshCw className="w-4 h-4 animate-spin text-[#264d44]" />
            <span className="text-sm italic">
              {generating ? "Maya is preparing your briefing..." : "Loading briefing..."}
            </span>
          </div>
        )}

        {/* Error */}
        {error && !loading && !generating && (
          <div className="flex items-center gap-3 py-4 text-amber-700 bg-amber-50 rounded-xl px-4 mb-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">Maya is taking a coffee break. Try refreshing.</span>
          </div>
        )}

        {/* Briefing content */}
        {record && !loading && !generating && (
          <>
            <div className="space-y-1">
              {briefingParts.map((part, i) => {
                if (part.type === 'action') {
                  return (
                    <ActionItem
                      key={part.action.key}
                      action={part.action}
                      checkedItems={record.checked_items || {}}
                      onCheck={handleCheck}
                      currentUserName={currentUser?.full_name?.split(' ')[0] || 'User'}
                    />
                  );
                }
                return (
                  <div key={i} className="prose prose-sm max-w-none text-gray-700 [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_ul]:my-1 [&_li]:my-0.5 [&_strong]:text-gray-900 [&_p]:my-1">
                    <ReactMarkdown>{part.content}</ReactMarkdown>
                  </div>
                );
              })}
            </div>

            {/* Action items summary if any */}
            {actionItems.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">
                {Object.keys(record.checked_items || {}).length} of {actionItems.length} action{actionItems.length !== 1 ? 's' : ''} completed
              </p>
            )}

            {/* Stats bar */}
            {record.stats && (
              <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
                  <strong className="text-gray-700">{record.stats.overdue_partners}</strong> overdue partners
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                  <strong className="text-gray-700">{record.stats.silent_clients}</strong> silent clients
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                  <strong className="text-gray-700">{record.stats.renewal_clients}</strong> renewal clients
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
                  <strong className="text-gray-700">{record.stats.active_partners}</strong> active partners
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}