import React, { useState, useEffect } from 'react';
import { Sparkles, X } from 'lucide-react';

const DISMISS_KEY = 'qb_inquiries_banner_dismissed_ts';

/**
 * Dismissible banner surfacing new Quick Builder inquiries.
 * Reappears when a newer inquiry arrives than the last dismissal timestamp.
 */
export default function QuickBuilderInquiriesBanner({ inquiries, onViewInquiries }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!inquiries || inquiries.length === 0) {
      setVisible(false);
      return;
    }
    const dismissedTs = Number(localStorage.getItem(DISMISS_KEY) || 0);
    const newestDate = Math.max(...inquiries.map(i => new Date(i.created_date).getTime()));
    setVisible(newestDate > dismissedTs);
  }, [inquiries]);

  const handleDismiss = (e) => {
    e.stopPropagation();
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      onClick={onViewInquiries}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewInquiries();
        }
      }}
      className="mb-5 cursor-pointer group"
    >
      <div className="flex items-center gap-3 bg-[#013f7c] text-white rounded-xl px-4 py-3 group-hover:bg-[#012d5a] transition-colors">
        <div className="flex-shrink-0 bg-white/20 rounded-full p-2">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">
            {inquiries.length} new Quick Builder inquiry{inquiries.length !== 1 ? 's' : ''}
          </p>
          <p className="text-sm text-blue-100">
            Companies submitted campaign selections via the public Quick Builder. Click to review.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1.5 rounded-lg hover:bg-white/20 transition-colors flex-shrink-0"
          aria-label="Dismiss banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}