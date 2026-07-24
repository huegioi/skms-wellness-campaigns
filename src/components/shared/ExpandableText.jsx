import React, { useState } from 'react';

/**
 * Truncates long text to N lines with a "Show more" / "Show less" toggle.
 * Uses a character/line heuristic to decide whether the toggle is needed.
 */
export default function ExpandableText({ text, maxLines = 3, className = '', placeholder = '' }) {
  const [expanded, setExpanded] = useState(false);

  if (text == null || text === '') {
    return <span className="text-gray-300 italic">{placeholder}</span>;
  }

  const str = String(text);
  const isLong = str.length > 150 || str.split('\n').length > maxLines;

  return (
    <div>
      <p
        className={`whitespace-pre-line ${className || 'text-sm text-gray-700'}`}
        style={!expanded && isLong
          ? { display: '-webkit-box', WebkitLineClamp: maxLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
          : {}}
      >
        {str}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="text-xs text-blue-600 hover:underline mt-0.5"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}