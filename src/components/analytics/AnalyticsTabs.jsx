import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Activity, FlaskConical } from 'lucide-react';

/**
 * Sub-navigation for the Analytics section.
 *
 * The sidebar item was called "Feedback" and pointed at a single page. It is now
 * "Analytics" with two pages under it, so the section needs its own strip — the
 * sidebar only highlights the group, it cannot show which page inside it you are
 * on. Register any new Analytics page BOTH here and in Layout.jsx's altPages,
 * or the sidebar will stop highlighting when you navigate to it.
 */
const TABS = [
  { page: 'FeedbackAnalytics', label: 'Wellness Analytics', icon: Activity },
  { page: 'RoiTestBed', label: 'ROI Test Bed', icon: FlaskConical },
];

export default function AnalyticsTabs({ current }) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm self-start w-fit mb-6">
      {TABS.map(t => {
        const active = t.page === current;
        const Icon = t.icon;
        return (
          <Link
            key={t.page}
            to={createPageUrl(t.page)}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
              active ? 'bg-[#013f7c] text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {t.label}
          </Link>
        );
      })}
    </div>
  );
}
