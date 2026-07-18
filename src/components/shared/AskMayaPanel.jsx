import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Sparkles } from 'lucide-react';
import MayaMarkdown from '@/components/shared/MayaMarkdown';

/**
 * Global "Ask Maya" slide-over — session-only chat history (no persistence).
 * Calls askMaya with no record context (global business questions).
 */
export default function AskMayaPanel({ open, onOpenChange, pendingQuestion, onThinkingChange, onQuestionConsumed }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const scrollRef = useRef(null);
  const pendingRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Notify parent (orb) when thinking state changes — quickens the breathing.
  useEffect(() => {
    onThinkingChange?.(loading);
  }, [loading, onThinkingChange]);

  // Auto-submit a pending question (from orb greeting / context bubble) when the panel opens.
  useEffect(() => {
    if (open && pendingQuestion && !pendingRef.current) {
      pendingRef.current = pendingQuestion;
      onQuestionConsumed?.();
      submitQuestion(pendingQuestion.question, pendingQuestion.recordType, pendingQuestion.recordId);
    }
    if (!open) {
      pendingRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingQuestion]);

  const submitQuestion = async (q, recordType, recordId) => {
    if (!q || loading) return;
    const next = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setLoading(true);
    setLoadingStage(0);
    const stageTimer = setInterval(() => setLoadingStage(s => Math.min(s + 1, 2)), 1500);
    try {
      const payload = { question: q };
      if (recordType && recordId) {
        payload.record_type = recordType;
        payload.record_id = recordId;
      }
      const res = await base44.functions.invoke('askMaya', payload);
      setMessages([...next, { role: 'assistant', content: res.data?.answer || 'No answer.' }]);
    } catch (err) {
      setMessages([
        ...next,
        { role: 'assistant', content: '_Sorry — I could not answer that. Please try again._' },
      ]);
    } finally {
      clearInterval(stageTimer);
      setLoadingStage(0);
      setLoading(false);
    }
  };

  const ask = (e) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    submitQuestion(q);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0">
        <SheetHeader className="px-4 py-3 border-b border-gray-100 space-y-0">
          <SheetTitle className="flex items-center gap-2 text-base text-[#013f7c]">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            Ask Maya
          </SheetTitle>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="text-center py-8 px-2">
              <div className="text-3xl mb-2">🧠</div>
              <p className="text-sm text-gray-500 leading-relaxed">
                Ask Maya about your pipeline, strategy, renewal season, or how to
                use the platform.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
            >
              {m.role === 'user' ? (
                <div className="bg-[#013f7c] text-white text-sm rounded-2xl rounded-br-sm px-3.5 py-2 max-w-[85%]">
                  {m.content}
                </div>
              ) : (
                <div className="bg-gray-50 text-gray-800 text-sm rounded-2xl rounded-bl-sm px-3.5 py-2.5 max-w-[92%] prose prose-sm max-w-none
                  [&_p]:my-1 [&_p]:leading-relaxed
                  [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4
                  [&_li]:my-0.5
                  [&_strong]:text-gray-900
                  [&_em]:text-gray-400 [&_em]:text-xs">
                  <MayaMarkdown>{m.content}</MayaMarkdown>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-400 pl-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              {loadingStage === 0 ? 'Reading the record…' : loadingStage === 1 ? 'Analyzing context…' : 'Thinking…'}
            </div>
          )}
        </div>

        <form onSubmit={ask} className="border-t border-gray-100 p-3 flex gap-2 bg-white">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Maya…"
            className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <Button
            type="submit"
            size="icon"
            disabled={loading || !input.trim()}
            className="rounded-full bg-indigo-600 hover:bg-indigo-700 h-9 w-9 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}