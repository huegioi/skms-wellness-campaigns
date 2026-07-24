import React, { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useSaveBadge } from '@/components/shared/SaveBadge';
import SaveBadge from '@/components/shared/SaveBadge';
import ExpandableText from '@/components/shared/ExpandableText';

/**
 * Inline-editable note for an interaction in the Activity timeline.
 * Click the note text or pencil icon to edit. Save on blur with green
 * Saved badge. Error toast on failure. Only notes is editable.
 */
export default function EditableInteractionNote({ item, scopeKey }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.notes || '');
  const { show: showSaved, trigger: triggerSaved } = useSaveBadge();
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(item.notes || '');
  }, [item.notes, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      const len = inputRef.current.value.length;
      inputRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const save = async () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed === (item.notes || '')) return;

    try {
      await base44.entities.ClientInteraction.update(item.id, { notes: trimmed });
      queryClient.invalidateQueries({ queryKey: scopeKey });
      triggerSaved();
    } catch (e) {
      toast.error('Failed to save note', { description: e?.message || 'Unknown error' });
      setDraft(item.notes || '');
    }
  };

  if (editing) {
    return (
      <div className="mt-0.5">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setDraft(item.notes || '');
              setEditing(false);
            }
          }}
          className="w-full bg-white border border-[#013f7c] rounded-md px-2 py-1 text-xs outline-none ring-2 ring-[#013f7c]/10 resize-y min-h-[60px]"
          rows={3}
        />
      </div>
    );
  }

  return (
    <div className="mt-0.5 group/note">
      <div className="flex items-start gap-1.5">
        <div className="flex-1 min-w-0">
          {item.notes ? (
            <ExpandableText text={item.notes} maxLines={3} className="text-xs text-gray-600" />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-gray-300 italic hover:text-gray-500"
            >
              Add note...
            </button>
          )}
        </div>
        {item.notes && (
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover/note:opacity-100 text-gray-400 hover:text-gray-600 transition-opacity flex-shrink-0 pt-0.5"
            aria-label="Edit note"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
        <SaveBadge show={showSaved} />
      </div>
    </div>
  );
}