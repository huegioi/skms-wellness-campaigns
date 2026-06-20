import React, { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';

// Collapsible "How we measured this" methodology note.
export default function MethodologyNote() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-[#e6e1d8] overflow-hidden" style={{ backgroundColor: '#f9f8f5' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-[#f4f0e9] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-[#013f7c]" />
          <span className="text-sm font-semibold text-[#013f7c]">How we measured this</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-4 text-xs text-gray-600 leading-relaxed space-y-2">
          <p><strong>Leading indicators</strong> (participation, session pulse, eNPS, completion rate) measure engagement and immediate reaction &mdash; they turn early and predict downstream change.</p>
          <p><strong>Lagging indicators</strong> (WHO-5, UWES-3, PSS-4, UCLA-3, CBI) are validated wellbeing instruments that move more slowly. They are shown as pre&rarr;post deltas across matched participants.</p>
          <p><strong>Direction of good:</strong> WHO-5, UWES-3, and eNPS are &ldquo;higher is better.&rdquo; PSS-4, UCLA-3, and CBI are &ldquo;lower is better&rdquo; &mdash; a drop is colored green.</p>
          <p><strong>Matching:</strong> Pre/post pairs are matched by normalized participant email. Completion rate = distinct end responders &divide; distinct starters.</p>
          <p><strong>Reach:</strong> When an eligible-population roster is available, Reach = responders &divide; eligible. Without a roster, only the responder count is shown.</p>
          <p><strong>Evidence tier:</strong> Cohort data uses a matched comparison (same people, pre/post). Challenge data is an uncontrolled pre/post program effect. Neither is a randomized controlled trial.</p>
          <p><strong>Normalization:</strong> The Wellbeing Profile normalizes each instrument to 0&ndash;100 and inverts worse-direction instruments so &ldquo;up&rdquo; always reads as better.</p>
        </div>
      )}
    </div>
  );
}