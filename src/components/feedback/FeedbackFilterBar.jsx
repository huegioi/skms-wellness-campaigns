import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const CATEGORY_LABELS = {
  workshop: 'Workshop',
  challenge: 'Challenge',
  leadership: 'Leadership',
  class: 'Class',
  wellness_box: 'Wellness Box',
};

const FORMAT_LABELS = {
  virtual: 'Virtual',
  in_person: 'In-Person',
  hybrid: 'Hybrid',
};

const INSTRUMENT_OPTIONS = [
  { value: 'all', label: 'All Instruments' },
  { value: 'who5', label: 'WHO-5' },
  { value: 'uwes3', label: 'UWES-3' },
  { value: 'pss4', label: 'PSS-4' },
  { value: 'ucla3', label: 'UCLA-3' },
  { value: 'cbi', label: 'CBI' },
  { value: 'enps', label: 'eNPS' },
];

const TOUCHPOINT_OPTIONS = [
  { value: 'all', label: 'All Touchpoints' },
  { value: 'day0', label: 'Day 0' },
  { value: 'day14', label: 'Day 14' },
  { value: 'cohort_start', label: 'Cohort Start' },
  { value: 'cohort_end', label: 'Cohort End' },
  { value: 'cohort_1mo', label: '30-Day Follow-Up' },
];

export default function FeedbackFilterBar({ filters, onChange, companies, speakers, activeView }) {
  const set = (key, val) => onChange({ ...filters, [key]: val });
  const hasActive = Object.entries(filters).some(([k, v]) => v && v !== 'all' && k !== 'startDate' && k !== 'endDate') || filters.startDate || filters.endDate;

  const reset = () => onChange({
    company: 'all',
    category: 'all',
    speaker: 'all',
    format: 'all',
    cohortYear: 'all',
    instrument: 'all',
    touchpoint: 'all',
    startDate: '',
    endDate: '',
  });

  // Build year options from current year back 5 years
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 mb-6">
      <div className="flex flex-wrap gap-3 items-end">

        {/* By Company */}
        <div className="min-w-[180px]">
          <label className="text-xs text-gray-400 font-semibold uppercase mb-1 block">Company</label>
          <Select value={filters.company} onValueChange={v => set('company', v)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="All Companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* By Program Category */}
        <div className="min-w-[160px]">
          <label className="text-xs text-gray-400 font-semibold uppercase mb-1 block">Program Type</label>
          <Select value={filters.category} onValueChange={v => set('category', v)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Cohort Year */}
        <div className="min-w-[140px]">
          <label className="text-xs text-gray-400 font-semibold uppercase mb-1 block">Cohort Year</label>
          <Select value={filters.cohortYear} onValueChange={v => set('cohortYear', v)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="All Years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {years.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* By Instrument — only relevant on the Instruments (assessment) tab */}
        {activeView !== 'pulse' && (
        <div className="min-w-[160px]">
          <label className="text-xs text-gray-400 font-semibold uppercase mb-1 block">Instrument</label>
          <Select value={filters.instrument || 'all'} onValueChange={v => set('instrument', v)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="All Instruments" />
            </SelectTrigger>
            <SelectContent>
              {INSTRUMENT_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        )}

        {/* By Touchpoint — only relevant on the Instruments (assessment) tab */}
        {activeView !== 'pulse' && (
        <div className="min-w-[160px]">
          <label className="text-xs text-gray-400 font-semibold uppercase mb-1 block">Touchpoint</label>
          <Select value={filters.touchpoint || 'all'} onValueChange={v => set('touchpoint', v)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="All Touchpoints" />
            </SelectTrigger>
            <SelectContent>
              {TOUCHPOINT_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        )}

        {/* By Speaker — only relevant on the Pulse tab */}
        {activeView === 'pulse' && (
        <div className="min-w-[160px]">
          <label className="text-xs text-gray-400 font-semibold uppercase mb-1 block">Speaker</label>
          <Select value={filters.speaker} onValueChange={v => set('speaker', v)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="All Speakers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Speakers</SelectItem>
              {speakers.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        )}

        {/* By Format — only relevant on the Pulse tab */}
        {activeView === 'pulse' && (
        <div className="min-w-[150px]">
          <label className="text-xs text-gray-400 font-semibold uppercase mb-1 block">Delivery Format</label>
          <Select value={filters.format} onValueChange={v => set('format', v)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="All Formats" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Formats</SelectItem>
              {Object.entries(FORMAT_LABELS).map(([val, label]) => (
                <SelectItem key={val} value={val}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        )}

        {/* Date Range */}
        <div className="min-w-[130px]">
          <label className="text-xs text-gray-400 font-semibold uppercase mb-1 block">From Date</label>
          <Input
            type="date"
            className="h-8 text-sm"
            value={filters.startDate}
            onChange={e => set('startDate', e.target.value)}
          />
        </div>
        <div className="min-w-[130px]">
          <label className="text-xs text-gray-400 font-semibold uppercase mb-1 block">To Date</label>
          <Input
            type="date"
            className="h-8 text-sm"
            value={filters.endDate}
            onChange={e => set('endDate', e.target.value)}
          />
        </div>

        {/* Reset */}
        {hasActive && (
          <Button variant="ghost" size="sm" onClick={reset} className="h-8 text-gray-400 hover:text-gray-700 self-end">
            <X className="w-4 h-4 mr-1" /> Clear
          </Button>
        )}
      </div>
    </div>
  );
}