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

        {/* Orb */}
        <div className="relative pointer-events-auto">
          {/* Tooltip */}
          {hovered && !open && (
            <div className="absolute bottom-full right-0 mb-2.5 pointer-events-none whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg">
              Ask Maya · M
            </div>
          )}

          {/* Hover glow ring */}
          <div
            className="absolute inset-0 rounded-full transition-opacity duration-300 pointer-events-none"
            style={{
              boxShadow: '0 0 0 6px rgba(119, 1, 66, 0.18)',
              opacity: hovered ? 1 : 0,
            }}
          />

          <button
            onClick={handleOrbClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={`relative flex items-center justify-center rounded-full bg-[#770142] shadow-lg ${breatheClass}`}
            style={{ width: 52, height: 52 }}
            aria-label="Ask Maya"
          >
            <img
              src={LOGO_URL}
              alt=""
              className="w-7 h-7 object-contain pointer-events-none"
            />

            {/* Amber attention dot */}
            {showAttentionDot && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 border-2 border-white" />
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