import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import AskMayaPanel from '@/components/shared/AskMayaPanel';
import { base44 } from '@/api/base44Client';
import {
  getRecordContext,
  subscribeMayaOrb,
  isGreetingDismissed,
  dismissGreeting,
  isContextDismissed,
  dismissContext,
} from '@/lib/mayaOrbStore';

const LOGO_URL =
  'https://media.base44.com/images/public/6911f6f4a9d8505805b51a3b/bb0a43468_SKMSLogoShieldBrown.png';

/**
 * Fetch attention items: new Quick Builder inquiries, upcoming sessions
 * without an accepted presenter, and clients needing follow-up.
 */
async function fetchAttention() {
  try {
    const [inquiries, events, overdueClients] = await Promise.all([
      base44.entities.Lead.filter(
        { lead_type: 'company_inquiry', status: 'cold', is_demo: false },
        '-created_date',
        50
      ),
      base44.entities.CalendarEvent.filter(
        { completed: false, is_demo: false },
        '-start_date',
        100
      ),
      base44.entities.Client.filter(
        { follow_up_status: 'needs_followup', is_demo: false },
        '-created_date',
        100
      ),
    ]);
    const now = Date.now();
    const unaccepted = events.filter(
      (e) =>
        e.presenter_id &&
        !e.presenter_accepted &&
        new Date(e.start_date).getTime() > now - 86400000
    );
    return {
      total: inquiries.length + unaccepted.length + overdueClients.length,
    };
  } catch {
    return { total: 0 };
  }
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

export default function MayaOrb() {
  const [open, setOpen] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [attention, setAttention] = useState(null);
  const [recordContext, setRecordContext] = useState(getRecordContext());
  const [bubble, setBubble] = useState(null); // 'greeting' | 'context' | null
  const [hovered, setHovered] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState(null);

  // Subscribe to record-context changes from detail views.
  useEffect(() => subscribeMayaOrb((ctx) => setRecordContext(ctx)), []);

  // Fetch attention data once on mount.
  useEffect(() => {
    fetchAttention().then(setAttention);
  }, []);

  // Decide which bubble to show — greeting takes priority over context,
  // and nothing shows while the panel is open. Never stacks.
  useEffect(() => {
    if (open) {
      setBubble(null);
      return;
    }
    if (attention && attention.total > 0 && !isGreetingDismissed()) {
      setBubble('greeting');
    } else if (recordContext && !isContextDismissed()) {
      setBubble('context');
    } else {
      setBubble(null);
    }
  }, [attention, recordContext, open]);

  // Keyboard shortcut: "m" toggles the panel when no input is focused.
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'm' && e.key !== 'M') return;
      const el = document.activeElement;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable)
      )
        return;
      e.preventDefault();
      setOpen((prev) => !prev);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleOrbClick = () => {
    setBubble(null);
    setOpen((prev) => !prev);
  };

  const handleGreetingClick = () => {
    dismissGreeting();
    setBubble(null);
    setPendingQuestion({
      question:
        'What needs my attention today? Give me my morning briefing — new inquiries, overdue follow-ups, and sessions without an accepted presenter.',
    });
    setOpen(true);
  };

  const handleGreetingDismiss = (e) => {
    e.stopPropagation();
    dismissGreeting();
    setBubble(null);
  };

  const handleContextClick = () => {
    if (!recordContext) return;
    dismissContext();
    setBubble(null);
    setPendingQuestion({
      question: `Give me your read on ${recordContext.recordName}.`,
      recordType: recordContext.recordType,
      recordId: recordContext.recordId,
    });
    setOpen(true);
  };

  const handleContextDismiss = (e) => {
    e.stopPropagation();
    dismissContext();
    setBubble(null);
  };

  const showAttentionDot = !open && attention && attention.total > 0;
  const breatheClass = isThinking
    ? 'maya-orb-breathe--active'
    : 'maya-orb-breathe';

  return (
    <>
      {/* Floating orb + bubble — pointer-events-none wrapper so content
          beneath is never blocked; only the orb and bubble are interactive. */}
      <div className="fixed bottom-[72px] lg:bottom-6 right-4 lg:right-6 z-40 flex items-end gap-2.5 pointer-events-none">
        {/* Greeting / context bubble */}
        {bubble && (
          <div className="pointer-events-auto mb-1 max-w-[230px]">
            <div
              onClick={
                bubble === 'greeting'
                  ? handleGreetingClick
                  : handleContextClick
              }
              className="cursor-pointer rounded-xl bg-white shadow-lg border border-gray-100 px-3.5 py-2.5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start gap-2">
                <p className="text-xs text-gray-700 leading-snug flex-1">
                  {bubble === 'greeting'
                    ? `${timeGreeting()} — ${attention.total} ${
                        attention.total === 1 ? 'thing' : 'things'
                      } need you today`
                    : `Want my read on ${recordContext?.recordName}?`}
                </p>
                <button
                  onClick={
                    bubble === 'greeting'
                      ? handleGreetingDismiss
                      : handleContextDismiss
                  }
                  className="text-gray-300 hover:text-gray-600 shrink-0 transition-colors"
                  aria-label="Dismiss"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Orb — Soft Gradient Horizon glass-morphism */}
        <div className="relative pointer-events-auto" style={{ width: 52, height: 52 }}>
          {/* Tooltip */}
          {hovered && !open && (
            <div className="absolute bottom-full right-0 mb-2.5 pointer-events-none whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg">
              Ask Maya · M
            </div>
          )}

          {/* Soft outer glow halo */}
          <div
            className="absolute inset-0 rounded-full maya-orb-glow pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(178,243,242,0.45) 0%, rgba(252,212,225,0.25) 55%, transparent 75%)',
              filter: 'blur(6px)',
            }}
          />

          {/* Hover glow ring */}
          <div
            className="absolute inset-0 rounded-full transition-opacity duration-300 pointer-events-none"
            style={{
              boxShadow: '0 0 0 5px rgba(178, 243, 242, 0.22)',
              opacity: hovered ? 1 : 0,
            }}
          />

          <button
            onClick={handleOrbClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={`relative w-full h-full rounded-full overflow-hidden flex items-center justify-center ${breatheClass}`}
            style={{
              background:
                'radial-gradient(circle at 30% 30%, #B2F3F2 0%, #C8EDE8 35%, #E8D4E0 70%, #FCD4E1 100%)',
              boxShadow:
                '0 4px 18px rgba(178,243,242,0.3), 0 2px 8px rgba(252,212,225,0.3), inset 0 1px 4px rgba(255,255,255,0.65), inset 0 -1px 3px rgba(180,200,210,0.2)',
            }}
            aria-label="Ask Maya"
          >
            {/* Spinning conic gradient — creates living color-shift effect */}
            <div
              className="absolute inset-0 rounded-full maya-orb-spin maya-orb-colors"
              style={{
                background:
                  'conic-gradient(from 0deg, rgba(178,243,242,0.45), rgba(252,212,225,0.4), rgba(178,223,226,0.45), rgba(232,212,224,0.4), rgba(178,243,242,0.45))',
              }}
            />

            {/* Glass gloss highlight (top-left) */}
            <div
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                background:
                  'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.55) 0%, transparent 45%)',
              }}
            />

            {/* Center label */}
            <span className="relative z-10 text-[10px] font-semibold text-gray-500/80 tracking-wide pointer-events-none select-none">
              Maya
            </span>

            {/* Amber attention dot */}
            {showAttentionDot && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-white z-20" />
            )}
          </button>
        </div>
      </div>

      <AskMayaPanel
        open={open}
        onOpenChange={setOpen}
        pendingQuestion={pendingQuestion}
        onThinkingChange={setIsThinking}
        onQuestionConsumed={() => setPendingQuestion(null)}
      />
    </>
  );
}