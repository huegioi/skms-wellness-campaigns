import React from 'react';

export function renderInline(text) {
  const parts = String(text).split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} className="font-semibold">{part.replace(/^\*\*|\*\*$/g, '')}</strong>
      : part
  );
}