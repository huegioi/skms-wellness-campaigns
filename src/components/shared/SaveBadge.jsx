import React, { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';

/**
 * A brief "Saved" confirmation: green circle checkmark + "Saved" text
 * that fades out after ~2 seconds.
 *
 * Usage:
 *   const { show, trigger } = useSaveBadge();
 *   // ... after successful save:
 *   trigger();
 *   // in JSX:
 *   <SaveBadge show={show} />
 */
export function useSaveBadge(durationMs = 2000) {
  const [show, setShow] = useState(false);

  const trigger = () => {
    setShow(true);
  };

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => setShow(false), durationMs);
    return () => clearTimeout(timer);
  }, [show, durationMs]);

  return { show, trigger };
}

export default function SaveBadge({ show }) {
  if (!show) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium text-green-600 save-badge-fade"
      role="status"
      aria-live="polite"
    >
      <CheckCircle className="w-3.5 h-3.5" />
      Saved
    </span>
  );
}