import React, { useState, useEffect, useRef } from 'react';

export function InlineText({ label, value, onSave, multiline = false, className = '', placeholder = 'Click to add' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value != null ? String(value) : '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(value != null ? String(value) : '');
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select?.();
    }
  }, [editing]);

  const startEdit = () => {
    setDraft(value != null ? String(value) : '');
    setEditing(true);
  };

  const save = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== (value != null ? String(value) : '')) onSave(trimmed);
  };

  const cancel = () => {
    setDraft(value != null ? String(value) : '');
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (multiline && e.shiftKey) return;
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  if (editing) {
    const inputClass = `w-full bg-white border border-[#013f7c] rounded-md px-2 py-1 outline-none ring-2 ring-[#013f7c]/10 ${className}`;
    if (multiline) {
      return (
        <textarea
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={handleKeyDown}
          className={`${inputClass} min-h-[60px] resize-y`}
          rows={3}
        />
      );
    }
    return (
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        className={inputClass}
      />
    );
  }

  return (
    <div
      className="group cursor-text rounded-md px-1.5 py-0.5 -mx-1.5 hover:bg-gray-50 transition-colors"
      onClick={startEdit}
    >
      {label && (
        <span className="block text-[10px] uppercase tracking-wide text-gray-400">{label}</span>
      )}
      <span className={className || 'text-sm text-gray-700'}>
        {value != null && value !== '' ? value : <span className="text-gray-300 italic">{placeholder}</span>}
      </span>
    </div>
  );
}

export default InlineText;