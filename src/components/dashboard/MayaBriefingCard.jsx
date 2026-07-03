import React, { useState, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw, AlertCircle, ChevronDown, ChevronUp, CheckCircle2, Circle } from 'lucide-react';
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

// Rename "X To-Dos" headers to just "X"
const SECTION_LABEL_MAP = {
  'client to-dos': 'Clients',
  'partner to-dos': 'Partners',
  'campaign to-do': 'Campaign',
  'campaign to-dos': 'Campaign',
  'other': 'Other',
};

function normHeader(raw) {
  const lower = raw.toLowerCase().trim();
  return SECTION_LABEL_MAP[lower] || raw.trim();
}

// Parse briefing text into structured sections
function parseBriefing(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect bold header: **Section Name**
    const headerMatch = trimmed.match(/^\*\*([^*]+)\*\*\s*$/);
    if (headerMatch) {
      if (currentSection) sections.push(currentSection);
      currentSection = { label: normHeader(headerMatch[1]), items: [], type: 'section' };
      continue;
    }

    if (!currentSection) {
      // Opening paragraph lines (before first header)
      const last = sections[sections.length - 1];
      if (last?.type === 'opening') {
        if (trimmed) last.lines.push(trimmed);
      } else if (trimmed) {
        sections.push({ type: 'opening', lines: [trimmed] });
      }
      continue;
    }

    // Numbered list item: "1. Name — action" or "• item"
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)/);
    const bulletMatch = trimmed.match(/^[•\-\*]\s+(.+)/);

    if (numberedMatch) {
      currentSection.items.push({ id: `${currentSection.label}_${currentSection.items.length}`, text: numberedMatch[1].trim() });
    } else if (bulletMatch) {
      currentSection.items.push({ id: `${currentSection.label}_${currentSection.items.length}`, text: bulletMatch[1].trim() });
    } else if (trimmed) {
      // Prose line inside a section (e.g. "Other" paragraph)
      currentSection.items.push({ id: `${currentSection.label}_prose_${currentSection.items.length}`, text: trimmed, prose: true });
    }
  }

  if (currentSection) sections.push(currentSection);
  return sections;
}

function CheckableItem({ item, checked, onToggle }) {
  const isChecked = !!checked;

  if (item.prose) {
    return (
      <p className="text-sm text-gray-600 leading-relaxed">{item.text}</p>
    );
  }

  return (
    <div
      className={`flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors group ${
        isChecked ? 'bg-green-50' : 'hover:bg-gray-50'
      }`}
      onClick={() => onToggle(item.id, isChecked)}
    >
      <div className="mt-0.5 flex-shrink-0">
        {isChecked
          ? <CheckCircle2 className="w-4 h-4 text-green-500" />
          : <Circle className="w-4 h-4 text-gray-300 group-hover:text-gray-400" />
        }
      </div>
      <span className={`text-sm leading-snug ${isChecked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
        {item.text}
        {isChecked && checked.name && (
          <span className="ml-2 text-xs text-green-600 no-underline not-italic font-medium">
            ✓ {checked.name}
          </span>
        )}
      </span>
    </div>
  );
}

const SECTION_COLORS = {
  Clients:  'text-[#013f7c]',
  Partners: 'text-[#264d44]',
  Campaign: 'text-[#770142]',
  Other:    'text-gray-500',
};

function BriefingSection({ section, checkedItems, onToggle }) {
  const color = SECTION_COLORS[section.label] || 'text-gray-700';
  return (
    <div className="pt-3">
      <h3 className={`text-xs font-bold uppercase tracking-widest mb-2 ${color}`}>{section.label}</h3>
      <div className="space-y-0.5">
        {section.items.map(item => (
          <CheckableItem
            key={item.id}
            item={item}
            checked={checkedItems?.[item.id]}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

export default function MayaBriefingCard() {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  const loadOrGenerate = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(false);

    if (!forceRefresh) {
      const records = await base44.entities.MayaBriefing.list('-generated_at', 1).catch(() => []);
      const latest = records[0];
      if (latest && isToday(latest.generated_at)) {
        setRecord(latest);
        setLoading(false);
        return;
      }
    }

    setGenerating(true);
    const res = await base44.functions.invoke('mayaDailyBriefing', {}).catch(() => null);
    setGenerating(false);

    if (!res?.data?.briefing) {
      setError(true);
      const fallback = await base44.entities.MayaBriefing.list('-generated_at', 1).catch(() => []);
      if (fallback[0]) setRecord(fallback[0]);
    } else {
      const { briefing, stats, generated_at } = res.data;
      const newRecord = await base44.entities.MayaBriefing.create({
        briefing_text: briefing,
        stats: stats || {},
        generated_at: generated_at || new Date().toISOString(),
        checked_items: {},
      }).catch(() => null);

      setRecord(newRecord || { briefing_text: briefing, stats, generated_at: generated_at || new Date().toISOString(), checked_items: {} });
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadOrGenerate(false); }, []);

  const handleToggle = async (key, isCurrentlyChecked) => {
    if (!record) return;
    const userName = currentUser?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0] || 'User';
    const updated = { ...(record.checked_items || {}) };

    if (isCurrentlyChecked) {
      delete updated[key];
    } else {
      updated[key] = { name: userName, timestamp: new Date().toISOString() };
    }

    setRecord(r => ({ ...r, checked_items: updated }));
    if (record.id) {
      await base44.entities.MayaBriefing.update(record.id, { checked_items: updated }).catch(() => {});
    }
  };

  const sections = parseBriefing(record?.briefing_text || '');
  const opening = sections.find(s => s.type === 'opening');
  const contentSections = sections.filter(s => s.type === 'section');

  // Count checkable items
  const allCheckable = contentSections.flatMap(s => s.items.filter(i => !i.prose));
  const checkedCount = allCheckable.filter(i => !!(record?.checked_items || {})[i.id]).length;

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
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => loadOrGenerate(true)} disabled={loading || generating} className="gap-1.5 text-xs">
              <RefreshCw className={`w-3 h-3 ${(loading || generating) ? 'animate-spin' : ''}`} />
              {generating ? 'Generating...' : loading ? 'Loading...' : 'Refresh'}
            </Button>
            <button onClick={() => setCollapsed(c => !c)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {collapsed && !loading && !generating && record && (
          <p className="text-xs text-gray-400 italic">Briefing hidden — click ↑ to expand</p>
        )}

        {!collapsed && (loading || generating) && (
          <div className="flex items-center gap-3 py-6 text-gray-500">
            <RefreshCw className="w-4 h-4 animate-spin text-[#264d44]" />
            <span className="text-sm italic">
              {generating ? 'Maya is analyzing your pipeline… this may take 15–20 seconds.' : 'Loading briefing...'}
            </span>
          </div>
        )}

        {!collapsed && error && !loading && !generating && (
          <div className="flex items-center gap-3 py-4 text-amber-700 bg-amber-50 rounded-xl px-4 mb-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">Maya is taking a coffee break. Try refreshing.</span>
          </div>
        )}

        {!collapsed && record && !loading && !generating && (
          <>
            {/* Opening paragraph */}
            {opening && (
              <p className="text-sm text-gray-700 leading-relaxed mb-2">
                {opening.lines.join(' ')}
              </p>
            )}

            {/* Sections */}
            <div className="divide-y divide-gray-100">
              {contentSections.map(section => (
                <BriefingSection
                  key={section.label}
                  section={section}
                  checkedItems={record.checked_items || {}}
                  onToggle={handleToggle}
                />
              ))}
            </div>

            {/* Progress + stats */}
            {allCheckable.length > 0 && (
              <p className="text-xs text-gray-400 mt-3">
                {checkedCount} of {allCheckable.length} task{allCheckable.length !== 1 ? 's' : ''} completed
              </p>
            )}

            {record.stats && (
              <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
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
                {record.stats.new_inquiries > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#770142] inline-block" />
                    <strong className="text-gray-700">{record.stats.new_inquiries}</strong> new inquiries
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}